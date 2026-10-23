# Optional permanent public deployment. The game has no runtime external dependencies.
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod main.go tunnel.go main_test.go ./
COPY public/ ./public/
RUN CGO_ENABLED=0 go test ./... && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /mojiarms .
FROM scratch
COPY --from=build /mojiarms /mojiarms
ENV PORT=10000
EXPOSE 10000
ENTRYPOINT ["/mojiarms","--no-browser"]
