
\```markdown

\# Технические требования по безопасности для веб-приложения (MVP)

\## 1. HTTPS и перенаправление

\### Конфигурация Nginx

\```nginx

\# /etc/nginx/sites-available/your-app

\# HTTP → HTTPS редирект

server {

`    `listen 80;

`    `server\_name your-domain.ru;

`    `return 301 https://$server\_name$request\_uri;

}

\# HTTPS основной

server {

`    `listen 443 ssl http2;

`    `server\_name your-domain.ru;

`    `ssl\_certificate     /etc/letsencrypt/live/your-domain.ru/fullchain.pem;

`    `ssl\_certificate\_key /etc/letsencrypt/live/your-domain.ru/privkey.pem;

`    `add\_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

`    `ssl\_protocols TLSv1.2 TLSv1.3;

`    `ssl\_ciphers HIGH:!aNULL:!MD5;

`    `ssl\_prefer\_server\_ciphers on;

`    `location / {

`        `proxy\_pass http://localhost:3000;

`        `proxy\_set\_header Host $host;

`        `proxy\_set\_header X-Real-IP $remote\_addr;

`        `proxy\_set\_header X-Forwarded-For $proxy\_add\_x\_forwarded\_for;

`        `proxy\_set\_header X-Forwarded-Proto $scheme;

`    `}

}

\```

Express.js (альтернатива)

\```javascript

const express = require('express');

const app = express();

app.use((req, res, next) => {

`    `if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE\_ENV === 'production') {

`        `return res.redirect(301, 'https://' + req.headers.host + req.url);

`    `}

`    `next();

});

const helmet = require('helmet');

app.use(helmet.hsts({

`    `maxAge: 31536000,

`    `includeSubDomains: true,

`    `preload: true

}));

\```

\---

2\. LDAP-аутентификация (LDAPS)

\```javascript

// ldap-client.js

const ldap = require('ldapjs');

const LDAP\_CONFIG = {

`    `url: 'ldaps://ldap.your-domain.ru:636',

`    `baseDN: 'dc=your-domain,dc=ru',

`    `bindDN: 'cn=readonly,ou=services,dc=your-domain,dc=ru',

`    `bindPassword: process.env.LDAP\_PASSWORD,

`    `timeout: 5000,

`    `reconnect: true

};

async function authenticateUser(username, password) {

`    `const client = ldap.createClient({ url: LDAP\_CONFIG.url });

`    `return new Promise((resolve, reject) => {

`        `client.bind(LDAP\_CONFIG.bindDN, LDAP\_CONFIG.bindPassword, (err) => {

`            `if (err) return reject(err);

`            `const searchOptions = {

`                `filter: `(uid=${username})`,

`                `scope: 'sub',

`                `attributes: ['dn', 'cn', 'mail', 'memberOf']

`            `};

`            `client.search(LDAP\_CONFIG.baseDN, searchOptions, (searchErr, res) => {

`                `if (searchErr) return reject(searchErr);

`                `let user = null;

`                `res.on('searchEntry', (entry) => { user = entry.object; });

`                `res.on('error', (err) => reject(err));

`                `res.on('end', () => {

`                    `if (!user) return reject(new Error('User not found'));

`                    `const userDN = user.dn;

`                    `client.bind(userDN, password, (bindErr) => {

`                        `if (bindErr) return reject(new Error('Invalid password'));

`                        `resolve({

`                            `id: user.uid,

`                            `name: user.cn,

`                            `email: user.mail,

`                            `roles: extractRoles(user.memberOf)

`                        `});

`                        `client.unbind();

`                    `});

`                `});

`            `});

`        `});

`    `});

}

app.post('/api/auth/login', async (req, res) => {

`    `const { username, password } = req.body;

`    `try {

`        `const user = await authenticateUser(username, password);

`        `const token = jwt.sign(

`            `{ userId: user.id, role: user.roles[0] },

`            `process.env.JWT\_SECRET,

`            `{ expiresIn: '8h' }

`        `);

`        `res.json({ token, user });

`    `} catch (err) {

`        `logger.warn('Login failed', { username, ip: req.ip });

`        `res.status(401).json({ error: 'Invalid credentials' });

`    `}

});

\```

\---

3\. TOTP 2FA для администраторов

\```bash

npm install speakeasy qrcode

\```

\```javascript

const speakeasy = require('speakeasy');

const QRCode = require('qrcode');

// GET /api/auth/2fa/setup

app.get('/api/auth/2fa/setup', async (req, res) => {

`    `if (req.user.role !== 'admin') {

`        `return res.status(403).json({ error: 'Forbidden' });

`    `}

`    `const secret = speakeasy.generateSecret({

`        `name: `YourApp:${req.user.email}`,

`        `length: 20

`    `});

`    `await db.saveTempSecret(req.user.id, secret.base32);

`    `const qrCode = await QRCode.toDataURL(secret.otpauth\_url);

`    `res.json({ secret: secret.base32, qrCode });

});

// POST /api/auth/2fa/verify

app.post('/api/auth/2fa/verify', async (req, res) => {

`    `const { token } = req.body;

`    `const secret = await db.getTempSecret(req.user.id);

`    `const verified = speakeasy.totp.verify({

`        `secret: secret,

`        `encoding: 'base32',

`        `token: token,

`        `window: 1

`    `});

`    `if (verified) {

`        `await db.enable2FA(req.user.id, secret);

`        `res.json({ success: true });

`    `} else {

`        `res.status(400).json({ error: 'Invalid token' });

`    `}

});

// Логин с 2FA

app.post('/api/auth/login', async (req, res) => {

`    `const { username, password, totpToken } = req.body;

`    `const user = await authenticateUser(username, password);

`    `if (user.is2FAEnabled) {

`        `const verified = speakeasy.totp.verify({

`            `secret: user.totpSecret,

`            `encoding: 'base32',

`            `token: totpToken,

`            `window: 1

`        `});

`        `if (!verified) {

`            `return res.status(401).json({ error: 'Invalid 2FA token' });

`        `}

`    `}

`    `const token = jwt.sign({ userId: user.id }, process.env.JWT\_SECRET);

`    `res.json({ token });

});

\```

\---

4\. RBAC на бэкенде

\```javascript

// middleware/auth.js

function checkRole(requiredRoles) {

`    `return (req, res, next) => {

`        `const userRole = req.user?.role;

`        `if (!userRole) {

`            `return res.status(401).json({ error: 'Unauthorized' });

`        `}

`        `if (Array.isArray(requiredRoles) && !requiredRoles.includes(userRole)) {

`            `logger.warn('Access denied', { 

`                `userId: req.user.id, 

`                `role: userRole, 

`                `endpoint: req.path 

`            `});

`            `return res.status(403).json({ error: 'Forbidden' });

`        `}

`        `if (typeof requiredRoles === 'string' && userRole !== requiredRoles) {

`            `return res.status(403).json({ error: 'Forbidden' });

`        `}

`        `next();

`    `};

}

// Примеры использования

app.delete('/api/users/:id', authMiddleware, checkRole('admin'), async (req, res) => {

`    `// Только для администраторов

});

app.post('/api/scenarios/copy', authMiddleware, checkRole(['instructor', 'admin']), async (req, res) => {

`    `// Для инструкторов и администраторов

});

app.post('/api/sessions/run', authMiddleware, checkRole('student'), async (req, res) => {

`    `// Только для учеников

});

\```

\---

5\. Rate Limiting на /login

\```bash

npm install express-rate-limit

\```

\```javascript

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({

`    `windowMs: 60 \* 1000,

`    `max: 5,

`    `standardHeaders: true,

`    `legacyHeaders: false,

`    `keyGenerator: (req) => req.ip,

`    `handler: (req, res) => {

`        `logger.warn('Rate limit exceeded', { ip: req.ip, username: req.body.username });

`        `res.status(429).json({

`            `error: 'Too many login attempts. Please try again after 1 minute.'

`        `});

`    `}

});

app.post('/api/auth/login', loginLimiter, async (req, res) => {

`    `// Обычная логика логина

});

const apiLimiter = rateLimit({

`    `windowMs: 15 \* 60 \* 1000,

`    `max: 100,

`    `message: 'Too many requests from this IP'

});

app.use('/api/', apiLimiter);

\```

Альтернатива (Nginx):

\```nginx

limit\_req\_zone $binary\_remote\_addr zone=login\_limit:10m rate=5r/m;

server {

`    `location /api/auth/login {

`        `limit\_req zone=login\_limit burst=10 nodelay;

`        `limit\_req\_status 429;

`        `proxy\_pass http://localhost:3000;

`    `}

}

\```

\---

6\. Логирование

\```bash

npm install winston winston-daily-rotate-file

\```

\```javascript

// logger.js

const winston = require('winston');

const DailyRotateFile = require('winston-daily-rotate-file');

const path = require('path');

const logFormat = winston.format.combine(

`    `winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),

`    `winston.format.errors({ stack: true }),

`    `winston.format.json()

);

const logger = winston.createLogger({

`    `level: 'info',

`    `format: logFormat,

`    `transports: [

`        `new winston.transports.File({

`            `filename: path.join(\_\_dirname, '../logs/app.log'),

`            `maxsize: 50 \* 1024 \* 1024,

`            `maxFiles: 10,

`            `tailable: true

`        `}),

`        `new winston.transports.File({

`            `filename: path.join(\_\_dirname, '../logs/error.log'),

`            `level: 'error',

`            `maxsize: 50 \* 1024 \* 1024,

`            `maxFiles: 10

`        `}),

`        `new winston.transports.Console({

`            `format: winston.format.simple()

`        `})

`    `]

});

module.exports = logger;

\```

Использование:

\```javascript

const logger = require('./logger');

// Логирование входа

logger.info('User logged in', {

`    `userId: user.id,

`    `username: user.username,

`    `ip: req.ip,

`    `userAgent: req.headers['user-agent']

});

// Логирование ошибок

logger.warn('Failed login attempt', {

`    `username: req.body.username,

`    `ip: req.ip,

`    `reason: 'Invalid credentials'

});

// Логирование действий администратора

logger.info('Admin action', {

`    `adminId: req.user.id,

`    `method: req.method,

`    `path: req.path,

`    `body: req.body

});

\```

\---

7\. CSP и CSRF-защита

\```bash

npm install helmet csurf cookie-parser

\```

\```javascript

const helmet = require('helmet');

const csrf = require('csurf');

const cookieParser = require('cookie-parser');

// CSP

app.use(helmet.contentSecurityPolicy({

`    `directives: {

`        `defaultSrc: ["'self'"],

`        `scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],

`        `styleSrc: ["'self'", "'unsafe-inline'"],

`        `imgSrc: ["'self'", "data:"],

`        `connectSrc: ["'self'"],

`        `fontSrc: ["'self'", "https://fonts.gstatic.com"],

`        `objectSrc: ["'none'"],

`        `upgradeInsecureRequests: []

`    `}

}));

// CSRF

app.use(cookieParser());

const csrfProtection = csrf({

`    `cookie: {

`        `httpOnly: true,

`        `secure: true,

`        `sameSite: 'lax'

`    `}

});

app.get('/api/csrf-token', csrfProtection, (req, res) => {

`    `res.json({ csrfToken: req.csrfToken() });

});

app.post('/api/scenarios', csrfProtection, async (req, res) => {

`    `// Защищенный эндпоинт

});

// Дополнительные заголовки

app.use(helmet.xFrameOptions({ action: 'deny' }));

app.use(helmet.xssFilter());

app.use(helmet.noSniff());

app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

\```

\---

8\. Хранение логов (30 дней)

Вариант А: Winston Daily Rotate

\```javascript

const DailyRotateFile = require('winston-daily-rotate-file');

const transport = new DailyRotateFile({

`    `filename: 'logs/app-%DATE%.log',

`    `datePattern: 'YYYY-MM-DD',

`    `maxSize: '50m',

`    `maxFiles: '30d',

`    `zippedArchive: true

});

const logger = winston.createLogger({

`    `transports: [transport]

});

\```

Вариант Б: Linux logrotate

\```bash

\# /etc/logrotate.d/your-app

/var/log/your-app/\*.log {

`    `daily

`    `rotate 30

`    `maxsize 50M

`    `compress

`    `delaycompress

`    `missingok

`    `notifempty

`    `create 0640 www-data www-data

`    `sharedscripts

`    `postrotate

`        `systemctl reload your-app

`    `endscript

}

\```

Вариант В: Cron-скрипт

\```bash

\# /usr/local/bin/clean-logs.sh

#!/bin/bash

find /var/log/your-app/ -name "\*.log" -type f -mtime +30 -delete

\# Добавить в crontab

\# 0 2 \* \* \* /usr/local/bin/clean-logs.sh

\```

\---

📋 Итоговый чек-лист

№ Мера Статус

1 HTTPS включен, HTTP → HTTPS редирект ☐

2 LDAP-аутентификация работает (LDAPS) ☐

3 TOTP 2FA для администраторов ☐

4 RBAC проверяется на бэкенде ☐

5 Rate Limiting на /login (5 попыток/мин) ☐

6 Логи пишутся (входы, ошибки, действия админов) ☐

7 CSP и CSRF-защита включены ☐

8 Срок хранения логов — минимум 30 дней ☐

\---

🚀 Быстрый старт (все зависимости)

\```bash

npm install express helmet csurf cookie-parser winston winston-daily-rotate-file speakeasy qrcode ldapjs express-rate-limit jsonwebtoken

\```

\---

🔐 Переменные окружения (.env)

\```env

NODE\_ENV=production

PORT=3000

JWT\_SECRET=your\_super\_secret\_key\_here

LDAP\_URL=ldaps://ldap.your-domain.ru:636

LDAP\_BASE\_DN=dc=your-domain,dc=ru

LDAP\_BIND\_DN=cn=readonly,ou=services,dc=your-domain, dc=ru

LDAP\_PASSWORD=your\_ldap\_password

\```
🔥 Критические изменения для K8s

1. Не храните секреты в Docker-образе — используйте K8s Secrets / Vault
2. Не пишите логи в файлы внутри контейнера — пишите в stdout/stderr (их соберет Fluentd / Loki)
3. Используйте StatefulSet для БД, а не Deployment (для сохранения состояния)
4. Настройте readiness/liveness пробы — K8s будет перезапускать упавшие поды
5. Network Policies — изолируйте поды друг от друга (важно для безопасности)

