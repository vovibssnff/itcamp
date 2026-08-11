# build stage
# Контекст сборки = services/go (содержит scenario/ + shared/),
# поэтому replace ../shared резолвится корректно.
FROM golang:1.25-alpine AS builder
WORKDIR /src/scenario

COPY scenario/go.mod scenario/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download

COPY scenario/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/scenario ./cmd/scenario

# runtime stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/scenario /app/scenario
COPY scenario/deploy/config.example.toml /app/config.toml

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/scenario", "-config", "/app/config.toml"]
