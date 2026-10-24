package main

import (
 "net/http"
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
 }{
  if got:=w.Header().Get(k);got!=want{t.Errorf("%s %q want %q",k,got,want)}
 }
}
