package storage

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/itcamp/ktc/services/snapshot/internal/config"
)

type S3Storage struct {
	client *minio.Client
	bucket string
}

func New(ctx context.Context, cfg config.S3Config) (*S3Storage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("minio init: %w", err)
	}

	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("minio bucket check: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio make bucket: %w", err)
		}
	}

	return &S3Storage{client: client, bucket: cfg.Bucket}, nil
}

func (s *S3Storage) Save(ctx context.Context, key string, data []byte) (string, error) {
	compressed, err := gzipCompress(data)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(data)
	sha := hex.EncodeToString(hash[:])

	_, err = s.client.PutObject(ctx, s.bucket, key, bytes.NewReader(compressed), int64(len(compressed)), minio.PutObjectOptions{
		ContentType: "application/gzip",
	})
	if err != nil {
		return "", fmt.Errorf("s3 put: %w", err)
	}

	return sha, nil
}

func (s *S3Storage) Load(ctx context.Context, key string) ([]byte, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("s3 get: %w", err)
	}
	defer func() { _ = obj.Close() }()

	compressed, err := io.ReadAll(obj)
	if err != nil {
		return nil, fmt.Errorf("s3 read: %w", err)
	}

	data, err := gzipDecompress(compressed)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

func gzipCompress(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func gzipDecompress(data []byte) ([]byte, error) {
	r, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer func() { _ = r.Close() }()
	return io.ReadAll(r)
}

func ComputeSHA256(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func ValidateSHA256(data []byte, expected string) bool {
	return ComputeSHA256(data) == expected
}
