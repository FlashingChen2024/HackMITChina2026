package service

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type AlertNotifier interface {
	Notify(ctx context.Context, to string, subject string, body string) error
}

type noopAlertNotifier struct{}

func (noopAlertNotifier) Notify(_ context.Context, _ string, _ string, _ string) error {
	return nil
}

func NewNoopAlertNotifier() AlertNotifier {
	return noopAlertNotifier{}
}

type SMTPAlertNotifier struct {
	host     string
	port     int
	username string
	password string
	from     string
}

func NewSMTPAlertNotifier(host string, port int, username string, password string, from string) AlertNotifier {
	host = strings.TrimSpace(host)
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	from = strings.TrimSpace(from)
	if host == "" || port <= 0 || username == "" || password == "" {
		return noopAlertNotifier{}
	}
	if from == "" {
		from = username
	}
	return &SMTPAlertNotifier{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
	}
}

func (n *SMTPAlertNotifier) Notify(_ context.Context, to string, subject string, body string) error {
	to = strings.TrimSpace(to)
	if to == "" {
		return nil
	}

	addr := fmt.Sprintf("%s:%d", n.host, n.port)
	auth := smtp.PlainAuth("", n.username, n.password, n.host)
	msg := buildEmailMessage(n.from, to, subject, body)

	if n.port == 465 {
		dialer := &net.Dialer{Timeout: 8 * time.Second}
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
			ServerName: n.host,
			MinVersion: tls.VersionTLS12,
		})
		if err != nil {
			return fmt.Errorf("smtp tls dial: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, n.host)
		if err != nil {
			return fmt.Errorf("smtp new client: %w", err)
		}
		defer client.Close()

		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
		if err := client.Mail(n.from); err != nil {
			return fmt.Errorf("smtp mail: %w", err)
		}
		if err := client.Rcpt(to); err != nil {
			return fmt.Errorf("smtp rcpt: %w", err)
		}

		writer, err := client.Data()
		if err != nil {
			return fmt.Errorf("smtp data: %w", err)
		}
		if _, err := writer.Write(msg); err != nil {
			_ = writer.Close()
			return fmt.Errorf("smtp write data: %w", err)
		}
		if err := writer.Close(); err != nil {
			return fmt.Errorf("smtp close data: %w", err)
		}
		if err := client.Quit(); err != nil {
			return fmt.Errorf("smtp quit: %w", err)
		}
		return nil
	}

	if err := smtp.SendMail(addr, auth, n.from, []string{to}, msg); err != nil {
		return fmt.Errorf("smtp send mail: %w", err)
	}
	return nil
}

func buildEmailMessage(from string, to string, subject string, body string) []byte {
	return []byte(
		fmt.Sprintf(
			"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n",
			from,
			to,
			subject,
			body,
		),
	)
}
