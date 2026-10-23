package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

const cfWindowsURL = "https://github.com/cloudflare/cloudflared/releases/download/2026.10.2/cloudflared-windows-amd64.exe"
const cfWindowsSHA256 = "4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6"

var tunnelLink = regexp.MustCompile(`https://[a-z0-9-]+\.trycloudflare\.com`)

func checksum(path, hash string) bool {
	f, e := os.Open(path)
	if e != nil {
		return false
	}
	defer f.Close()
	h := sha256.New()
	_, e = io.Copy(h, f)
	if e != nil {
		return false
	}
	return strings.EqualFold(hex.EncodeToString(h.Sum(nil)), hash)
}
func cloudflaredPath() (string, error) {
	if path := os.Getenv("MOJI_CLOUDFLARED_PATH"); path != "" {
		return path, nil
	}
	if found, e := exec.LookPath("cloudflared"); e == nil {
		return found, nil
	}
	if runtime.GOOS != "windows" {
		return "", errors.New("Windows以外は cloudflared のインストールが必要です（公式ドキュメント参照）")
	}
	if runtime.GOARCH != "amd64" {
		return "", errors.New("この実行ファイルはWindows x64用です")
	}
	cache, e := os.UserCacheDir()
	if e != nil {
		return "", e
	}
	path := filepath.Join(cache, "MojiArms", "cloudflared-windows-amd64.exe")
	if checksum(path, cfWindowsSHA256) {
		return path, nil
	}
	if e := os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		return "", e
	}
	fmt.Println("初回のみ、公式配布元から Cloudflare Tunnel の実行ファイルを取得します。")
	fmt.Println("※ Pythonや追加のアカウント登録は不要。ダウンロードにはインターネット接続が必要です。")
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	req, e := http.NewRequestWithContext(ctx, "GET", cfWindowsURL, nil)
	if e != nil {
		return "", e
	}
	req.Header.Set("User-Agent", "MojiArms/6.3 (Cloudflare tunnel downloader)")
	resp, e := http.DefaultClient.Do(req)
	if e != nil {
		return "", fmt.Errorf("ダウンロードできませんでした: %w", e)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("ダウンロード先がHTTP %dを返しました", resp.StatusCode)
	}
	if resp.ContentLength > 120*1024*1024 {
		return "", errors.New("ダウンロードが大きすぎます")
	}
	temp := path + ".partial"
	f, e := os.Create(temp)
	if e != nil {
		return "", e
	}
	size, e := io.Copy(f, io.LimitReader(resp.Body, 120*1024*1024+1))
	closeErr := f.Close()
	if e != nil || closeErr != nil || size > 120*1024*1024 {
		_ = os.Remove(temp)
		return "", errors.New("ダウンロードが中断されました")
	}
	if !checksum(temp, cfWindowsSHA256) {
		_ = os.Remove(temp)
		return "", errors.New("公式ファイルのSHA-256チェックに失敗しました")
	}
	if e = os.Rename(temp, path); e != nil {
		return "", e
	}
	return path, nil
}

func startTunnel(ctx context.Context, port int) (string, error) {
	bin, e := cloudflaredPath()
	if e != nil {
		return "", e
	}
	cmd := exec.CommandContext(ctx, bin, "tunnel", "--url", fmt.Sprintf("http://127.0.0.1:%d", port))
	stdout, e := cmd.StdoutPipe()
	if e != nil {
		return "", e
	}
	stderr, e := cmd.StderrPipe()
	if e != nil {
		return "", e
	}
	if e = cmd.Start(); e != nil {
		return "", e
	}
	links := make(chan string, 2)
	errorsCh := make(chan error, 1)
	scan := func(r io.Reader) {
		sc := bufio.NewScanner(r)
		sc.Buffer(make([]byte, 16*1024), 1024*1024)
		for sc.Scan() {
			line := sc.Text()
			if match := tunnelLink.FindString(line); match != "" {
				select {
				case links <- match:
				default:
				}
			}
			if strings.Contains(line, "ERR") || strings.Contains(line, "error") || strings.Contains(line, "trycloudflare.com") {
				fmt.Println("[トンネル]", line)
			}
		}
	}
	go scan(stderr)
	go scan(stdout)
	go func() { errorsCh <- cmd.Wait() }()
	timer := time.NewTimer(100 * time.Second)
	defer timer.Stop()
	for {
		select {
		case url := <-links:
			go func() {
				if e := <-errorsCh; e != nil {
					fmt.Println("公開トンネルが停止しました:", e)
				}
			}()
			// The URL is printed before DNS has propagated. Verify it is reachable before opening.
			probe := &http.Client{Timeout: 6 * time.Second}
			valid := false
			for attempt := 0; attempt < 12; attempt++ {
				resp, e := probe.Get(url + "/healthz")
				if e == nil {
					var content []byte
					content, _ = io.ReadAll(io.LimitReader(resp.Body, 300))
					_ = resp.Body.Close()
					if resp.StatusCode == 200 && strings.Contains(string(content), `"ok":true`) {
						valid = true
						break
					}
				}
				time.Sleep(2 * time.Second)
			}
			if !valid {
				fmt.Println("公開URLの外部からの疎通確認は完了しませんでした。リンクが開けない場合は再起動してください。")
			}
			return url + "/", nil
		case e := <-errorsCh:
			if e == nil {
				e = errors.New("トンネルが終了しました")
			}
			return "", e
		case <-timer.C:
			return "", errors.New("公開URLの発行が時間切れになりました。ネットワークを確認してください")
		}
	}
}
