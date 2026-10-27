package main

import (
 "net/http"
 "encoding/base64"
 "net/http/httptest"
 "testing"
)

func TestPublicBetaWebSocketOriginHost(t *testing.T) {
 cases:=[]struct{
  name,host,origin,forward string
  allowed bool
 }{
  {"same HTTPS origin", "moji-arms-online.onrender.com", "https://moji-arms-online.onrender.com", "", true},
  {"same HTTP local origin", "localhost:8083", "http://localhost:8083", "", true},
  {"native clients without browser origin", "moji-arms-online.onrender.com", "", "", true},
  {"other site", "moji-arms-online.onrender.com", "https://evil.example", "", false},
  {"spoofed forwarded host cannot bypass", "moji-arms-online.onrender.com", "https://evil.example", "evil.example", false},
  {"forged subdomain", "moji-arms-online.onrender.com", "https://moji-arms-online.onrender.com.evil.example", "", false},
  {"path forbidden in origin", "moji-arms-online.onrender.com", "https://moji-arms-online.onrender.com/launch", "", false},
  {"invalid origin syntax", "moji-arms-online.onrender.com", "null", "", false},
  {"insecure scheme is not browser origin", "moji-arms-online.onrender.com", "file://moji-arms-online.onrender.com", "", false},
  {"wrong port", "localhost:8083", "http://localhost:3333", "", false},
 }
 for _,tt:=range cases{
  t.Run(tt.name,func(t *testing.T){
   req:=httptest.NewRequest(http.MethodGet,"http://"+tt.host+"/ws",nil)
   req.Host=tt.host
   if tt.origin!=""{req.Header.Set("Origin",tt.origin)}
   if tt.forward!=""{req.Header.Set("X-Forwarded-Host",tt.forward)}
   got:=websocketOriginAllowed(req)
   if got!=tt.allowed{t.Fatalf("allowed=%v want %v, Host=%q Origin=%q Forwarded=%q",got,tt.allowed,tt.host,tt.origin,tt.forward)}
   if !tt.allowed{
    w:=httptest.NewRecorder()
    websocketHandler(w,req)
    if w.Code!=http.StatusForbidden{t.Fatalf("server returned %d instead of 403",w.Code)}
   }
  })
 }
}

func TestPublicBetaSecurityHeaders(t *testing.T){
 downstream:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.WriteHeader(http.StatusNoContent)})
 handler:=publicResponseHeaders(downstream)
 w:=httptest.NewRecorder()
 handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"https://moji-arms-online.onrender.com/",nil))
 if w.Code!=http.StatusNoContent{t.Fatalf("HTTP status %d",w.Code)}
 for k,want:=range map[string]string{
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"SAMEORIGIN",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "Content-Security-Policy":"object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=()",
 }{
  if got:=w.Header().Get(k);got!=want{t.Errorf("%s %q want %q",k,got,want)}
 }
}

func TestWebSocketHandshakeEnforcesProtocolAndKey(t *testing.T) {
 validKey:=base64.StdEncoding.EncodeToString([]byte("0123456789abcdef"))
 request:=func() *http.Request {
  r:=httptest.NewRequest(http.MethodGet,"http://localhost:8083/ws",nil)
  r.Header.Set("Upgrade","websocket")
  r.Header.Set("Connection","keep-alive, Upgrade")
  r.Header.Set("Sec-WebSocket-Version","13")
  r.Header.Set("Sec-WebSocket-Key",validKey)
  return r
 }
 if !websocketHandshakeValid(request()){t.Fatal("legitimate WebSocket handshake rejected")}
 cases:=[]struct{name string;modify func(*http.Request)}{
  {"wrong method",func(r *http.Request){r.Method="POST"}},
  {"unsupported version",func(r *http.Request){r.Header.Set("Sec-WebSocket-Version","12")}},
  {"missing version",func(r *http.Request){r.Header.Del("Sec-WebSocket-Version")}},
  {"bad base64 key",func(r *http.Request){r.Header.Set("Sec-WebSocket-Key","not-base64%%")}},
  {"short key",func(r *http.Request){r.Header.Set("Sec-WebSocket-Key",base64.StdEncoding.EncodeToString([]byte("short")))}},
  {"empty key",func(r *http.Request){r.Header.Del("Sec-WebSocket-Key")}},
  {"connection token substring spoof",func(r *http.Request){r.Header.Set("Connection","notupgrade")}},
  {"wrong upgrade type",func(r *http.Request){r.Header.Set("Upgrade","h2c")}},
 }
 for _,tt:=range cases {
  t.Run(tt.name,func(t *testing.T){
   r:=request();tt.modify(r)
   if websocketHandshakeValid(r){t.Fatal("invalid handshake accepted")}
   w:=httptest.NewRecorder()
   websocketHandler(w,r)
   if w.Code!=http.StatusBadRequest {t.Fatalf("status %d; want 400",w.Code)}
  })
 }
}
func TestWebSocketCapacityLimit(t *testing.T) {
 if maxConcurrentWebSockets<30 || maxConcurrentWebSockets>1000 {
  t.Fatal("Socket limit should allow multiple matches but bound memory use")
 }
}
