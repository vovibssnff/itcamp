package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"

	"github.com/itcamp/ktc/services/gw/internal/config"
)

type Registry struct {
	mu        sync.RWMutex
	upstreams map[string]*httputil.ReverseProxy
	urls      map[string]*url.URL
}

func NewRegistry(upstreams map[string]config.UpstreamConfig) (*Registry, error) {
	r := &Registry{
		upstreams: make(map[string]*httputil.ReverseProxy, len(upstreams)),
		urls:      make(map[string]*url.URL, len(upstreams)),
	}
	for name, up := range upstreams {
		target, err := url.Parse(up.URL)
		if err != nil {
			return nil, err
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
			IncUpstreamError(name)
			http.Error(w, `{"error":"upstream unavailable","code":"upstream_unavailable"}`, http.StatusBadGateway)
		}
		r.upstreams[name] = proxy
		r.urls[name] = target
	}
	return r, nil
}

func (r *Registry) Get(name string) (*httputil.ReverseProxy, *url.URL, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.upstreams[name]
	if !ok {
		return nil, nil, false
	}
	return p, r.urls[name], true
}

func (r *Registry) ProxyHandler(route config.RouteConfig) http.Handler {
	proxy, target, ok := r.Get(route.Upstream)
	if !ok {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, `{"error":"upstream not found","code":"upstream_not_found"}`, http.StatusBadGateway)
		})
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		IncProxiedRequest(route.Upstream)

		if route.StripPrefix != "" {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, route.StripPrefix)
			if !strings.HasPrefix(req.URL.Path, "/") {
				req.URL.Path = "/" + req.URL.Path
			}
			req.URL.RawPath = ""
		}

		req.Header.Set("X-Forwarded-Host", req.Host)
		req.Header.Set("X-Forwarded-Proto", "https")

		if route.WebSocket {
			proxyWebSocket(w, req, target)
			return
		}

		proxy.ServeHTTP(w, req)
	})
}

func proxyWebSocket(w http.ResponseWriter, r *http.Request, target *url.URL) {
	r.URL.Scheme = target.Scheme
	r.URL.Host = target.Host

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ServeHTTP(w, r)
}
