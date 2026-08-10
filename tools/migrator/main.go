package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

const usage = `migrator — единый мигратор Picodata (PostgreSQL-wire)

Команды:
  up       Применить все неприменённые миграции
  down     Откатить миграции (-steps N, по умолчанию 1)
  version  Показать текущую версию
  force    Принудительно установить версию (-version N)
  create   Создать пустую миграцию (-name <name>, -service <service>)

Флаги:
  -dsn        Строка подключения (обязательно для up/down/version/force)
  -steps      Сколько миграций откатить (down, по умолчанию 1)
  -version    Версия для force
  -name       Имя миграции для create
  -service    Сервис для create (auth, constructor, scenario, ...)
  -migrations Путь к директории миграций (по умолчанию ../db/migrations)

Пример:
  go run ./tools/migrator up -dsn "postgres://user:pass@host:5432/ktc?sslmode=disable"
`

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(1)
	}

	cmd := os.Args[1]
	fs := flag.NewFlagSet(cmd, flag.ExitOnError)
	dsn := fs.String("dsn", "", "строка подключения Picodata")
	steps := fs.Int("steps", 1, "сколько миграций откатить (down)")
	version := fs.Int("version", 0, "версия для force")
	name := fs.String("name", "", "имя миграции (create)")
	service := fs.String("service", "", "сервис (create)")
	migrationsPath := fs.String("migrations", defaultMigrationsPath(), "путь к миграциям")
	_ = fs.Parse(os.Args[2:])

	switch cmd {
	case "up":
		mustDSN(*dsn)
		m := mustMigrate(*dsn, *migrationsPath)
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("up: %v", err)
		}
		v, dirty, _ := m.Version()
		fmt.Printf("OK: version=%d dirty=%v\n", v, dirty)

	case "down":
		mustDSN(*dsn)
		m := mustMigrate(*dsn, *migrationsPath)
		if err := m.Steps(-*steps); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("down: %v", err)
		}
		v, dirty, _ := m.Version()
		fmt.Printf("OK: version=%d dirty=%v\n", v, dirty)

	case "version":
		mustDSN(*dsn)
		m := mustMigrate(*dsn, *migrationsPath)
		v, dirty, err := m.Version()
		if err != nil {
			log.Fatalf("version: %v", err)
		}
		fmt.Printf("version=%d dirty=%v\n", v, dirty)

	case "force":
		mustDSN(*dsn)
		m := mustMigrate(*dsn, *migrationsPath)
		if err := m.Force(*version); err != nil {
			log.Fatalf("force: %v", err)
		}
		fmt.Printf("OK: forced version=%d\n", *version)

	case "create":
		if *name == "" || *service == "" {
			log.Fatal("create: -name и -service обязательны")
		}
		num := nextNumber(*migrationsPath, *service)
		base := fmt.Sprintf("%04d_%s_%s", num, *service, *name)
		upFile := filepath.Join(*migrationsPath, base+".up.sql")
		if err := os.WriteFile(upFile, []byte("-- "+base+"\n"), 0o644); err != nil {
			log.Fatalf("create: %v", err)
		}
		fmt.Printf("Создан: %s\n", upFile)

	default:
		fmt.Print(usage)
		os.Exit(1)
	}
}

func mustDSN(dsn string) {
	if dsn == "" {
		log.Fatal("-dsn обязателен")
	}
}

func mustMigrate(dsn, migrationsPath string) *migrate.Migrate {
	m, err := migrate.New("file://"+migrationsPath, dsn)
	if err != nil {
		log.Fatalf("migrate: %v", err)
	}
	return m
}

func defaultMigrationsPath() string {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	for _, candidate := range []string{
		filepath.Join(dir, "..", "db", "migrations"),
		filepath.Join(dir, "db", "migrations"),
		"db/migrations",
	} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "db/migrations"
}

func nextNumber(migrationsPath, service string) int {
	serviceRanges := map[string][2]int{
		"auth":         {1, 99},
		"constructor":  {100, 199},
		"scenario":     {200, 299},
		"orchestrator": {300, 399},
		"assessment":   {400, 499},
		"snapshot":     {500, 599},
		"report":       {600, 699},
	}
	r, ok := serviceRanges[service]
	if !ok {
		log.Fatalf("неизвестный сервис: %s", service)
	}
	return r[0]
}
