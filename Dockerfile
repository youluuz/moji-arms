# マルチプレイヤー用Goサーバー。ビルド時にはすべてのGo回帰テストを実行する。
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go ./
COPY public/ ./public/
RUN CGO_ENABLED=0 go test ./... -count=1 && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /mojiarms .

# 実行時はGoバイナリだけ: 追加課金対象のサービス・DBなし。
FROM scratch
COPY --from=build /mojiarms /mojiarms
ENV PORT=10000
EXPOSE 10000
ENTRYPOINT ["/mojiarms","--no-browser"]
