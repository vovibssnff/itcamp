package service

import (
	"encoding/json"
)

type WSClient struct {
	send   chan []byte
	role   string
	userID string
}

func NewWSClient(role, userID string) *WSClient {
	return &WSClient{
		send:   make(chan []byte, 64),
		role:   role,
		userID: userID,
	}
}

func (c *WSClient) Send(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}

func (c *WSClient) SendChan() <-chan []byte {
	return c.send
}

func (c *WSClient) Role() string   { return c.role }
func (c *WSClient) UserID() string { return c.userID }

func (c *WSClient) Close() {
	close(c.send)
}
