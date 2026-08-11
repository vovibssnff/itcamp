# build stage
# Контекст сборки = services/go (содержит constructor/ + shared/),
# поэтому replace ../shared резолвится корректно.
FROM golang:1.25-alpine AS builder
WORKDIR /src/constructor

COPY constructor/go.mod constructor/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download

COPY constructor/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/constructor ./cmd/constructor

# runtime stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/constructor /app/constructor
COPY constructor/deploy/config.example.toml /app/config.toml

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/constructor", "-config", "/app/config.toml"]
