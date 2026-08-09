# build stage
FROM golang:1.22-alpine AS builder
WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/auth ./cmd/auth

# runtime stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/auth /app/auth
COPY db/migrations /app/migrations
COPY deploy/config.example.toml /app/config.toml

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/auth", "-config", "/app/config.toml"]
