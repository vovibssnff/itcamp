# build stage
# Контекст сборки = services/go (содержит assessment/ + shared/),
# поэтому replace ../shared резолвится корректно.
FROM golang:1.22-alpine AS builder
WORKDIR /src/assessment
COPY assessment/go.mod assessment/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download
COPY assessment/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/assessment ./cmd/assessment

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/assessment /app/assessment
COPY assessment/deploy/config.example.toml /app/config.toml
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/assessment", "-config", "/app/config.toml"]
