package security

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strings"

	"github.com/go-ldap/ldap/v3"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type LDAPClient struct {
	cfg config.LDAPConfig
}

func NewLDAPClient(cfg config.LDAPConfig) *LDAPClient {
	return &LDAPClient{cfg: cfg}
}

type LDAPUser struct {
	DN       string
	Login    string
	FullName string
	Groups   []string
}

func (c *LDAPClient) Authenticate(ctx context.Context, login, password string) (AuthenticatedUser, error) {
	if password == "" {
		return AuthenticatedUser{}, domain.ErrInvalidCredentials
	}

	conn, err := c.dial()
	if err != nil {
		return AuthenticatedUser{}, fmt.Errorf("%w: %v", domain.ErrLDAPUnavailable, err)
	}
	defer conn.Close()

	if err := c.bindService(conn); err != nil {
		return AuthenticatedUser{}, fmt.Errorf("%w: service bind: %v", domain.ErrLDAPUnavailable, err)
	}

	ldapUser, err := c.findUser(conn, login)
	if err != nil {
		return AuthenticatedUser{}, err
	}

	if err := conn.Bind(ldapUser.DN, password); err != nil {
		return AuthenticatedUser{}, domain.ErrInvalidCredentials
	}

	return AuthenticatedUser{
		Login:    ldapUser.Login,
		FullName: ldapUser.FullName,
		DN:       ldapUser.DN,
		Roles:    c.MapRoles(ldapUser.Groups),
	}, nil
}

func (c *LDAPClient) dial() (*ldap.Conn, error) {
	opts := []ldap.DialOpt{
		ldap.DialWithDialer(&net.Dialer{Timeout: c.cfg.Timeout.Std()}),
	}
	if c.cfg.SkipVerify {
		opts = append(opts, ldap.DialWithTLSConfig(&tls.Config{InsecureSkipVerify: true}))
	}

	conn, err := ldap.DialURL(c.cfg.URL, opts...)
	if err != nil {
		return nil, err
	}

	if c.cfg.StartTLS && !strings.HasPrefix(c.cfg.URL, "ldaps://") {
		tlsCfg := &tls.Config{InsecureSkipVerify: c.cfg.SkipVerify}
		if err := conn.StartTLS(tlsCfg); err != nil {
			conn.Close()
			return nil, err
		}
	}
	return conn, nil
}

func (c *LDAPClient) bindService(conn *ldap.Conn) error {
	return conn.Bind(c.cfg.BindDN, c.cfg.BindPassword)
}

func (c *LDAPClient) findUser(conn *ldap.Conn, login string) (LDAPUser, error) {
	filter := fmt.Sprintf(c.cfg.UserFilter, ldap.EscapeFilter(login))
	req := ldap.NewSearchRequest(
		c.cfg.BaseDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		filter,
		[]string{"sAMAccountName", "cn", "displayName", c.cfg.GroupAttr},
		nil,
	)

	res, err := conn.Search(req)
	if err != nil {
		return LDAPUser{}, fmt.Errorf("%w: search: %v", domain.ErrLDAPUnavailable, err)
	}
	if len(res.Entries) == 0 {
		return LDAPUser{}, domain.ErrInvalidCredentials
	}
	if len(res.Entries) > 1 {
		return LDAPUser{}, fmt.Errorf("%w: multiple entries for login %s", domain.ErrLDAPUnavailable, login)
	}

	entry := res.Entries[0]
	user := LDAPUser{
		DN:       entry.DN,
		Login:    entry.GetAttributeValue("sAMAccountName"),
		FullName: firstNonEmpty(entry.GetAttributeValue("displayName"), entry.GetAttributeValue("cn"), login),
	}
	user.Groups = append(user.Groups, entry.GetAttributeValues(c.cfg.GroupAttr)...)
	return user, nil
}

func (c *LDAPClient) MapRoles(groups []string) []domain.Role {
	var roles []domain.Role
	for _, g := range groups {
		dn := strings.ToLower(g)
		switch {
		case c.cfg.AdminGroup != "" && strings.Contains(dn, strings.ToLower(c.cfg.AdminGroup)):
			roles = appendUnique(roles, domain.RoleAdmin)
		case c.cfg.InstructorGroup != "" && strings.Contains(dn, strings.ToLower(c.cfg.InstructorGroup)):
			roles = appendUnique(roles, domain.RoleInstructor)
		case c.cfg.OperatorGroup != "" && strings.Contains(dn, strings.ToLower(c.cfg.OperatorGroup)):
			roles = appendUnique(roles, domain.RoleOperator)
		}
	}
	return roles
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func appendUnique(roles []domain.Role, r domain.Role) []domain.Role {
	for _, existing := range roles {
		if existing == r {
			return roles
		}
	}
	return append(roles, r)
}
