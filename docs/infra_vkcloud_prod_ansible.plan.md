---
name: Production-развёртывание КТК на VK Cloud (Deckhouse + Ansible)
overview: "Пошаговый, самодостаточный план для исполнителя (в т.ч. слабой модели): создать production-конфигурации Deckhouse и коллекцию Ansible (playbook + роли), которая на N серверах VK Cloud поднимает весь стек КТК — кластер Deckhouse (Hybrid: cloud-masters + N статических worker-узлов через CAPS), edge (домен + Let's Encrypt TLS + Istio Ingress + Angie gw), data-layer (Picodata/Radix/S3/NATS), 12 микросервисов (Helm umbrella), миграции БД, seed демо-контента, наблюдаемость и smoke-тесты. Идемпотентно, с проверками на каждом шаге и критериями приёмки. Не дублирует teststand-план, а доводит инфраструктуру до production и добавляет push-деплой через Ansible."
todos:
  - id: P0
    content: "Фаза 0: procurement — VK Cloud проект/квоты/GPU, лицензия Deckhouse EE, домен+DNS API-токен, GHCR/registry, SSH-ключи, secrets. Закрыть чеклист §3"
    status: pending
  - id: P1
    content: "Фаза 1: Terraform — сеть/подсеть/роутер, floating IP, S3-бакеты, security groups и N VM (роли master/app/sim/ai/db) с cloud-init; вывести inventory-данные (§6)"
    status: pending
  - id: P2
    content: "Фаза 2: Ansible-скелет — коллекция ktc.infra, inventory (N серверов), group_vars/host_vars, ansible.cfg, requirements, ansible-vault; site.yml с тегами по фазам (§7)"
    status: pending
  - id: P3
    content: "Фаза 3: роли common + node_prereqs — OS baseline/hardening, sysctl/kernel, NTP, containerd-prereqs, firewall, users; идемпотентно на всех N серверах (§8.1–8.2)"
    status: pending
  - id: P4
    content: "Фаза 4: роль deckhouse_bootstrap — dhctl bootstrap (Hybrid, OpenStack cloud-provider, 1/3 master), получить kubeconfig на управляющий хост (§8.3, §9)"
    status: pending
  - id: P5
    content: "Фаза 5: роль deckhouse_static_nodes — SSHCredentials + StaticInstance по каждому worker-серверу + NodeGroup(nodeType:Static) app/sim/ai/db; дождаться Running (§8.4)"
    status: pending
  - id: P6
    content: "Фаза 6: роль deckhouse_modules — ModuleConfig prod (cni-cilium, cloud-provider-openstack, ingress-nginx LB на FIP, istio strict mTLS, cert-manager, monitoring, node-manager, GPU) (§8.5, §10)"
    status: pending
  - id: P7
    content: "Фаза 7: роль cluster_baseline — namespaces, PodSecurity, NetworkPolicy-матрица, ResourceQuota/LimitRange, Istio PeerAuthentication STRICT + AuthorizationPolicy, imagePullSecret (§8.6, §12)"
    status: pending
  - id: P8
    content: "Фаза 8: роль edge_tls — DNS A/AAAA + wildcard, ClusterIssuer letsencrypt (HTTP-01) и DNS-01 webhook, Certificate wildcard, Istio Gateway/Ingress на gw, redirect 80→443 (§8.7, §11)"
    status: pending
  - id: P9
    content: "Фаза 9: роль data_layer — Helm deploy Picodata(Raft N≥3)+Radix+NATS(JetStream N≥3); S3 = VK Cloud нативный; init buckets/streams; проверки (§8.8, §13)"
    status: pending
  - id: P10
    content: "Фаза 10: роль db_migrations — Job golang-migrate (tools/migrator) применяет db/migrations к Picodata; verify version (§8.9)"
    status: pending
  - id: P11
    content: "Фаза 11: Helm-чарты всех 12 сервисов + umbrella + values-prod (создать по шаблону; сейчас есть только gw+data-layer); роль app_deploy (§8.10, §14)"
    status: pending
  - id: P12
    content: "Фаза 12: роль seeds — Job загрузки библиотеки КТС (24 типа), демо-шаблон, ≥5 сценариев, ≥3 пресета (§8.11)"
    status: pending
  - id: P13
    content: "Фаза 13: роль observability — Пульт/Графиня datasource, Fluent Bit, дашборды, DCGM GPU-exporter, алерты (§8.12)"
    status: pending
  - id: P14
    content: "Фаза 14: роль smoke_tests — healthz/readyz, TLS-валидность, login→session→telemetry WS, RBAC negative, failover Picodata; критерии приёмки §15"
    status: pending
  - id: P15
    content: "Фаза 15: Day-2 runbook — обновления, масштабирование N серверов, бэкапы/восстановление, откаты, ротация секретов/сертификатов (§16)"
    status: pending
isProject: false
---

# Production-развёртывание «Конструктор КТК» на VK Cloud: Deckhouse-конфигурации + Ansible-коллекция

> **Кому адресован документ.** Исполнителю (в т.ч. неопытной/слабой модели). Каждая фаза — это: (1) что создать (файлы с точными путями и скелетами), (2) какие переменные подставить, (3) какие команды выполнить, (4) как проверить успех (verify), (5) как откатить. **Не пропускать verify-блоки** — они гейтят переход к следующей фазе.
>
> **Что должно получиться в итоге.** Один запуск `ansible-playbook site.yml` (после закрытия Фазы 0–1) на N серверах VK Cloud поднимает весь стек КТК так, что `https://<домен>` открывается с валидным TLS, работает логин, создаётся сессия, идёт телеметрия по WSS, а `d8 k get pods -A` — всё `Running`.

## 0. Как читать этот план (соглашения)

- `<ПЛЕЙСХОЛДЕР>` — значение, которое исполнитель подставляет из Фазы 0/1 (домен, IP, ключи).
- «Управляющий хост» (control host) — машина, с которой запускается Ansible/Terraform/dhctl (ноутбук инженера или bastion). На ней есть `docker`, `ansible` (≥2.16), `terraform` (≥1.5), `kubectl`/`d8`, `helm` (≥3.14), `jq`, `yq`.
- «N серверов» — целевые ВМ VK Cloud, на которых будет жить кластер. Роли: `master` (1 или 3), `app`, `sim`, `ai` (GPU), `db`. По умолчанию **минимальный prod**: 3 master + 2 app + 2 sim + 1 ai + 3 db = **11 ВМ** (масштабируется переменной, см. §5).
- Все имена сервисов/портов/переменных окружения берём из уже существующего репозитория (проверено): HTTP всех Go-сервисов — `:8080`, gRPC `sim` — `:50051`, gRPC `snapshot` — `:50052`; Picodata PG-wire `:4327`, iproto `:3301`; Radix/Redis `:7379`; NATS `:4222`; S3 `:9000`. Env-override секретов: `<SERVICE>_DB_DSN`, `<SERVICE>_NATS_URL`, `<SERVICE>_REDIS_ADDR`, `<SERVICE>_S3_*`, `AUTH_JWT_SIGNING_KEY`, `AUTH_TOTP_ENCRYPTION_KEY`, `GW_AUTH_URL`.
- **Инвариант между контурами** (local → teststand → prod): DNS-имена и env одинаковы, меняются только `values-*.yaml`. Не переписывать код сервисов.

## 1. Отношение к другим планам (не дублировать!)

| План | Что там | Что берём отсюда |
|---|---|---|
| [MVP](mvp_ктк_конструктор_f1ca3c09.plan.md) | какие сервисы/namespaces/node-pools/API деплоим | список 12 сервисов, namespaces `ktc-*`, node-pools app/sim/ai/db, NetworkPolicy-идея |
| [Teststand VK Cloud](infra_vkcloud_teststand.plan.md) | teststand через dhctl + Argo CD (pull-based) | переиспользуем Terraform/Deckhouse-заготовки из `infra/`, но **меняем модель доставки на Ansible push** и доводим до prod |
| [Локальный compose](infra_local_compose.plan.md) | dev-контур, env-конвенции | те же образы/env/имена |
| [SRD](SRD-Конструктор-КТК.md) | требования NFR/TEST | критерии приёмки §15 маппятся на NFR-*/TEST-* |
| **Этот план** | **production Deckhouse + Ansible-коллекция для N серверов** | — |

**Отличие от teststand:** teststand использует CloudEphemeral-узлы (Deckhouse сам создаёт ВМ) и Argo CD. Здесь — **prod**: (а) N явных серверов, которыми управляем через Terraform+Ansible; worker-узлы — **статические** (Deckhouse CAPS адаптирует их); (б) доставка приложений — **push через Ansible+Helm** (Argo CD оставляем как опциональный Day-2, см. §16.5); (в) hardening (strict mTLS, NetworkPolicy, PodSecurity, ResourceQuota, HA-мастер, бэкапы).

## 2. Ключевые архитектурные решения (ЗАФИКСИРОВАНЫ; при несогласии — поправить здесь и в переменных)

| # | Решение | Значение по умолчанию | Альтернатива (если не подходит) |
|---|---|---|---|
| D1 | Тип кластера Deckhouse | **Hybrid**: `clusterType: Cloud`, `provider: OpenStack` → cloud-masters (CloudEphemeral) + **статические** worker-узлы (app/sim/ai/db) через CAPS | Static-only (все узлы статические) → тогда нет OpenStack LB и Cinder CSI: нужен MetalLB + FIP на узел и ручной StorageClass (см. §17, Приложение A) |
| D2 | Почему Hybrid | cloud-provider даёт `OpenStack LoadBalancer` (привязка к floating IP) и Cinder CSI `StorageClass` для PV Picodata; при этом «N серверов» — это статические worker-ВМ, которыми управляет исполнитель | — |
| D3 | Edition Deckhouse | **EE** (на VK Cloud/OpenStack поддерживается только EE) | Managed K8s VK Cloud + ручной Istio/cert-manager — фиксировать как отступление от «Deckhouse» в рисках |
| D4 | Доставка приложений | **Ansible push** (`helm upgrade --install` через `kubernetes.core`) | Argo CD pull (Day-2, §16.5) |
| D5 | Секреты | `ansible-vault` (файлы) → K8s Secret через Ansible; опц. `sealed-secrets` | HashiCorp Vault (отложено, MVP §22) |
| D6 | TLS | cert-manager `letsencrypt`: HTTP-01 для точечных хостов; **DNS-01 webhook** для wildcard `*.<домен>` | точечные A-записи + HTTP-01 (без wildcard) |
| D7 | S3 | **нативный VK Cloud S3** (HotBox) — снапшоты/отчёты/иконки | in-cluster MinIO StatefulSet (если нужен on-prem) |
| D8 | Мастеров | 3 (HA, `NFR-REL-01`) | 1 (демо/экономия) — зафиксировать риск отсутствия HA control-plane |

## 3. Фаза 0 — Procurement (чеклист «готов к запуску»)

Не начинать Фазу 1, пока не закрыт весь список. Значения записать в `infra/ansible/group_vars/all/vars.yml` (несекретные) и `infra/ansible/group_vars/all/vault.yml` (секреты, `ansible-vault encrypt`).

- [ ] **VK Cloud**: проект, IAM-пользователь, `openrc v3` (переменные `OS_AUTH_URL`, `OS_USERNAME`, `OS_PASSWORD`, `OS_PROJECT_ID`, `OS_REGION_NAME`, `OS_USER_DOMAIN_NAME`).
- [ ] **Квоты подтверждены**: vCPU/RAM под N ВМ (см. §5 сумму), диски (high-iops), **GPU-flavor** (для `ai`), floating IP ≥ 2, LoadBalancer (LBaaS) ≥ 1, объём S3.
- [ ] **Лицензия Deckhouse EE**: ключ; `docker login registry.deckhouse.io -u license-token -p <KEY>` проходит с control host.
- [ ] **Домен**: `<DOMAIN>` (напр. `ktk.example.ru`) делегирован; есть **API-доступ к DNS-зоне** (токен провайдера) для DNS-01, если нужен wildcard.
- [ ] **Реестр образов приложений**: GHCR `ghcr.io/<org>/itcamp/*` (или отечественный registry-зеркало для prod). Есть pull-credentials (PAT `read:packages`).
- [ ] **SSH**: пара ключей `ktc_ed25519` (control host → все N серверов, пользователь `ubuntu`); публичный ключ уйдёт в cloud-init ВМ.
- [ ] **Образы data-layer** доступны: `docker.binary.picodata.io/picodata:25.5.9`, `redis:7.4-alpine` (или Radix-плагин при лицензии), `nats:2.11-alpine`, `docker.angie.software/angie:1.12.1`.
- [ ] **Секреты сгенерированы** (в vault): `AUTH_JWT_SIGNING_KEY` (или RS256-пара), `AUTH_TOTP_ENCRYPTION_KEY` (32 байта), `PICODATA_ADMIN_PASSWORD`, S3 access/secret, NATS creds, GHCR PAT.
- [ ] Control host укомплектован: `docker, ansible>=2.16, terraform>=1.5, helm>=3.14, kubectl, jq, yq`.

**Verify Фазы 0:** `docker login registry.deckhouse.io ...` → `Login Succeeded`; `openstack token issue` (или `curl $OS_AUTH_URL`) отвечает; `dig +short <DOMAIN>` возвращает NS вашей зоны.

## 4. Итоговая структура репозитория (что должно существовать после плана)

Существующее помечено `[есть]`, создаваемое — `[NEW]`. Не удалять `[есть]`, а расширять.

```
infra/
  terraform/                         [есть] vkcs+aws провайдеры, network/s3/outputs
    servers.tf                       [NEW]  N ВМ (master/app/sim/ai/db) + cloud-init + FIP-bind
    variables.servers.tf             [NEW]  counts/flavors per role
    inventory.tf                     [NEW]  генерация ansible inventory из outputs (local_file)
    env/prod.tfvars                  [NEW]  прод-значения (домен, counts, flavors)
  deckhouse/
    config.prod.yml.example          [NEW]  Hybrid, 3 master, prod release channel (§9)
    modules/*.prod.yaml              [NEW]  prod ModuleConfig (istio strict, ingress LB→FIP, monitoring retention, GPU) (§10)
    nodegroups/static-*.yaml         [NEW]  NodeGroup nodeType:Static app/sim/ai/db (§8.4)
  ansible/                           [NEW]  вся коллекция ниже
    ansible.cfg
    requirements.yml                 (galaxy collections: kubernetes.core, community.general, ansible.posix)
    inventory/prod/hosts.ini         (генерится Terraform или заполняется вручную)
    inventory/prod/group_vars/all/vars.yml
    inventory/prod/group_vars/all/vault.yml           (ansible-vault)
    inventory/prod/group_vars/{master,app,sim,ai,db}.yml
    site.yml                         (единый плейбук с тегами по фазам)
    playbooks/00_os.yml 01_bootstrap.yml 02_static_nodes.yml 03_modules.yml
              04_baseline.yml 05_edge.yml 06_data.yml 07_migrate.yml
              08_apps.yml 09_seeds.yml 10_obs.yml 11_smoke.yml
    collections/ktc/infra/roles/     (роли, §8)
      common/ node_prereqs/ deckhouse_bootstrap/ deckhouse_static_nodes/
      deckhouse_modules/ cluster_baseline/ edge_tls/ data_layer/
      db_migrations/ app_deploy/ seeds/ observability/ smoke_tests/
    files/  templates/               (общие k8s-манифесты/jinja)
deploy/
  charts/                            [есть только gw]
    _service/                        [NEW]  БАЗОВЫЙ chart-шаблон для Go/Python сервиса (§14.1)
    auth/ constructor/ scenario/ orchestrator/ assessment/ snapshot/
    report/ sim-manager/ sim-engine/ ai/ fe/   [NEW] по шаблону
  data-layer/                        [есть] расширить до Raft N≥3, NATS N≥3 (§13)
  umbrella/                          [NEW]  зонтичный chart (§14.2)
    Chart.yaml values-prod.yaml
  gitops/                            [опц. Day-2, §16.5]
```

## 5. Целевая топология и сайзинг (переменные Terraform/Ansible)

Переменные в `infra/terraform/env/prod.tfvars` и зеркалом в `group_vars/all/vars.yml` (`ktc_nodes`):

| Роль | Кол-во (по умолч.) | Flavor (пример VK Cloud) | vCPU/RAM/Disk | Особенности |
|---|---|---|---|---|
| `master` | 3 | STD3-8-16 | 8/16/60 high-iops | control-plane HA; CloudEphemeral (Deckhouse создаёт) |
| `app` | 2 | STD3-4-8 | 4/8/50 | stateless (gw, auth, constructor, scenario, orchestrator, assessment, snapshot, report, fe); label `ktc.role=app` |
| `sim` | 2 | STD3-8-16 | 8/16/50 | guaranteed QoS; taint `sim=true`; label `ktc.role=sim` |
| `ai` | 1 | GPU-flavor (напр. `GPU1-...`) | 8/32/100 + 1×GPU | taint `ai=true`; label `ktc.role=ai`; GPU Operator/DCGM |
| `db` | 3 | STD3-4-16 | 4/16/100 high-iops | Picodata Raft, anti-affinity; label `ktc.role=db` |

`master` — единственная CloudEphemeral-группа (Hybrid). `app/sim/ai/db` — **статические** ВМ, которые создаёт Terraform (§6) и адаптирует CAPS (§8.4). Число каждой роли — переменная `*_count`. «N серверов» = сумма static-ролей (по умолчанию 8) + масштабируется правкой counts.

**Namespaces** (уже в `infra/namespaces/ktc.yaml`, istio-injection на app/sim/ai): `ktc-app`, `ktc-sim`, `ktc-ai`, `ktc-data`, `ktc-infra`, `ktc-obs`.

## 6. Фаза 1 — Terraform: сеть + N серверов + FIP + S3

Расширяем существующий `infra/terraform/` (не ломать `network.tf`, `s3.tf`, `outputs.tf`).

### 6.1 Новые файлы

**`variables.servers.tf`** — счётчики и flavor'ы:
```hcl
variable "master_count" { type = number, default = 3 }
variable "app_count"    { type = number, default = 2 }
variable "sim_count"    { type = number, default = 2 }
variable "ai_count"     { type = number, default = 1 }
variable "db_count"     { type = number, default = 3 }
variable "flavor_master" { type = string, default = "STD3-8-16" }
variable "flavor_app"    { type = string, default = "STD3-4-8" }
variable "flavor_sim"    { type = string, default = "STD3-8-16" }
variable "flavor_ai"     { type = string, default = "GPU1-8-32" }  # ЗАМЕНИТЬ реальным GPU-flavor
variable "flavor_db"     { type = string, default = "STD3-4-16" }
variable "image_name"    { type = string, default = "ubuntu-22-04-cloudamd64" }
variable "ssh_public_key" { type = string }                        # содержимое ktc_ed25519.pub
variable "domain"        { type = string, default = "ktk.example.ru" }
```

**`servers.tf`** — только статические worker-ВМ (master в Hybrid создаёт Deckhouse). Для каждой роли — `count`, boot volume, привязка к сети/SG из `network.tf`, SSH-ключ через cloud-init:
```hcl
resource "vkcs_compute_keypair" "ktc" {
  name       = "${var.cluster_name}-key"
  public_key = var.ssh_public_key
}

locals {
  static_roles = { app = var.app_count, sim = var.sim_count, ai = var.ai_count, db = var.db_count }
  static_flavor = { app = var.flavor_app, sim = var.flavor_sim, ai = var.flavor_ai, db = var.flavor_db }
  # плоский список {role, index} для for_each
  static_nodes = merge([
    for role, n in local.static_roles : {
      for i in range(n) : "${role}-${i}" => { role = role, index = i }
    }
  ]...)
}

resource "vkcs_compute_instance" "node" {
  for_each          = local.static_nodes
  name              = "${var.cluster_name}-${each.key}"
  flavor_name       = local.static_flavor[each.value.role]
  key_pair          = vkcs_compute_keypair.ktc.name
  security_group_ids = [vkcs_networking_secgroup.cluster.id]
  availability_zone = "MS1"
  network { uuid = vkcs_networking_network.app.id }
  block_device {
    source_type           = "image"
    destination_type      = "volume"
    uuid                  = data.vkcs_images_image.ubuntu.id   # data-source по var.image_name
    volume_type           = "high-iops"
    volume_size           = each.value.role == "db" || each.value.role == "ai" ? 100 : 50
    boot_index            = 0
    delete_on_termination = true
  }
  # cloud-init: гарантировать python3 (для Ansible), отключить swap (для kubelet), поставить метку роли в hostname
  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", { role = each.value.role })
  metadata  = { ktc_role = each.value.role }
}
```

**`cloud-init.yaml.tftpl`**:
```yaml
#cloud-config
package_update: true
packages: [python3, python3-apt]
runcmd:
  - swapoff -a
  - sed -i '/ swap / s/^/#/' /etc/fstab
  - hostnamectl set-hostname ${role}-$(hostname -s)
```

**`inventory.tf`** — генерация Ansible-inventory из приватных IP ВМ (CAPS/Ansible ходят по внутренней сети; наружу только FIP на LB):
```hcl
resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/inventory/prod/hosts.ini"
  content  = templatefile("${path.module}/inventory.tftpl", {
    nodes = { for k, v in vkcs_compute_instance.node : k => {
      ip = v.access_ip_v4, role = local.static_nodes[k].role } }
    domain = var.domain
    ingress_fip = vkcs_networking_floatingip.ingress.address
  })
}
```

**`inventory.tftpl`** (результат — INI, сгруппированный по ролям):
```ini
# AUTO-GENERATED by terraform. Do not edit by hand.
[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/ktc_ed25519
ktc_domain=${domain}
ktc_ingress_fip=${ingress_fip}

%{ for role in ["app","sim","ai","db"] ~}
[${role}]
%{ for name, n in nodes ~}
%{ if n.role == role ~}
${name} ansible_host=${n.ip}
%{ endif ~}
%{ endfor ~}
%{ endfor ~}

[static:children]
app
sim
ai
db
```

> Примечание: master-узлы в Hybrid создаёт Deckhouse (см. §9), в inventory их нет. Если выбран Static-only (D1-альтернатива) — добавить группу `[master]` и создавать master-ВМ здесь же.

### 6.2 Команды и verify

```bash
cd infra/terraform
cp env/teststand.tfvars.example env/prod.tfvars   # заполнить domain, counts, flavors, ssh_public_key, s3 keys
terraform init
terraform plan  -var-file=env/prod.tfvars
terraform apply -var-file=env/prod.tfvars
terraform output ingress_floating_ip               # → записать как <FIP>
```
**Verify:** появился файл `infra/ansible/inventory/prod/hosts.ini` c IP; `terraform output` даёт `ingress_floating_ip`, `network_id`, `subnet_id`, `s3_*_bucket`; `ping`/`ssh ubuntu@<любой IP>` (по внутренней сети через bastion или временный FIP) проходит.

**Откат:** `terraform destroy -var-file=env/prod.tfvars` (осторожно с S3 `force_destroy=false`).

## 7. Фаза 2 — Скелет Ansible-коллекции

### 7.1 `infra/ansible/ansible.cfg`
```ini
[defaults]
inventory = inventory/prod/hosts.ini
collections_path = ./collections
roles_path = ./collections/ktc/infra/roles
host_key_checking = False
retry_files_enabled = False
stdout_callback = yaml
vault_password_file = .vault_pass         # gitignore! или -J при запуске
[ssh_connection]
pipelining = True
```

### 7.2 `requirements.yml`
```yaml
collections:
  - name: kubernetes.core        # helm/k8s модули
    version: ">=5.0.0"
  - name: community.general
  - name: ansible.posix
```
`ansible-galaxy collection install -r requirements.yml`

### 7.3 Переменные

**`group_vars/all/vars.yml`** (несекретные):
```yaml
ktc_domain: "ktk.example.ru"
ktc_cluster_name: "ktc-prod"
ktc_release_channel: "Stable"
ktc_master_count: 3
ktc_image_registry: "ghcr.io/<org>/itcamp"
ktc_image_tag: "v1.0.0"           # прод-тег; менять при релизе
ktc_namespaces: [ktc-app, ktc-sim, ktc-ai, ktc-data, ktc-infra, ktc-obs]
ktc_s3_endpoint: "https://hb.ru-msk.vkcloud-storage.ru"
ktc_s3_region: "ru-msk"
ktc_s3_buckets: { snapshots: "ktc-prod-snapshots", reports: "ktc-prod-reports", icons: "ktc-prod-component-icons" }
ktc_acme_email: "ops@example.ru"
ktc_letsencrypt_prod: true        # false = staging (для отладки, чтобы не упереться в rate-limit)
kubeconfig_path: "~/.kube/ktc-prod.config"
```

**`group_vars/all/vault.yml`** (`ansible-vault encrypt`):
```yaml
vault_deckhouse_license: "<EE_LICENSE_KEY>"
vault_os_password: "<OS_PASSWORD>"
vault_jwt_signing_key: "<64+ случайных байт base64>"
vault_totp_encryption_key: "<32 байта base64>"
vault_picodata_admin_password: "<strong>"
vault_s3_access_key: "<...>"
vault_s3_secret_key: "<...>"
vault_ghcr_pat: "<PAT read:packages>"
vault_dns_api_token: "<для DNS-01 webhook>"
```

**`group_vars/{sim,ai,db}.yml`** — метки/тейнты/nodeSelector-хинты (используются в StaticInstance-labels и NodeGroup, §8.4).

### 7.4 `site.yml` (единая точка входа, теги = фазы)
```yaml
- import_playbook: playbooks/00_os.yml         # tags: os
- import_playbook: playbooks/01_bootstrap.yml  # tags: bootstrap
- import_playbook: playbooks/02_static_nodes.yml # tags: nodes
- import_playbook: playbooks/03_modules.yml    # tags: modules
- import_playbook: playbooks/04_baseline.yml   # tags: baseline
- import_playbook: playbooks/05_edge.yml       # tags: edge
- import_playbook: playbooks/06_data.yml       # tags: data
- import_playbook: playbooks/07_migrate.yml    # tags: migrate
- import_playbook: playbooks/08_apps.yml       # tags: apps
- import_playbook: playbooks/09_seeds.yml      # tags: seeds
- import_playbook: playbooks/10_obs.yml        # tags: obs
- import_playbook: playbooks/11_smoke.yml      # tags: smoke
```
Запуск целиком: `ansible-playbook site.yml -J`. По фазам: `ansible-playbook site.yml --tags edge -J`.

**Verify Фазы 2:** `ansible-inventory --graph` показывает группы app/sim/ai/db с хостами; `ansible all -m ping` → `pong` со всех.

## 8. Фаза 3–14 — Роли (спецификация каждой)

Каждая роль: `defaults/main.yml`, `tasks/main.yml`, при необходимости `templates/`, `handlers/`, `meta/main.yml`. Все таски — **идемпотентные** (`state: present`, `creates:`, `changed_when`). Все k8s-операции — через `kubernetes.core.k8s`/`helm` с `kubeconfig: "{{ kubeconfig_path }}"` и запускаются на `localhost` (control host — `delegate_to: localhost`, `run_once: true`), кроме ролей common/node_prereqs (они бегут на серверах).

### 8.1 role `common` (на всех серверах) — playbook 00, hosts: static
Цель: базовый OS-baseline и hardening (Ubuntu 22.04).
- apt update/upgrade; установить `chrony`, `curl`, `gnupg`, `python3`; включить `chrony` (NTP — критично для детерминизма и TLS).
- Пользователи: убедиться, что `ubuntu` в `sudo`; захардить SSH (`PermitRootLogin no`, `PasswordAuthentication no`) через `templates/sshd.conf.j2` + handler `restart sshd`.
- `journald` limits, `unattended-upgrades` off (обновления через Day-2), timezone UTC.
- Верификация подключения роли к OT-сети запрещена (никаких лишних маршрутов) — просто не настраиваем.
**Verify:** `ansible static -m command -a "timedatectl show -p NTPSynchronized"` → `yes`.

### 8.2 role `node_prereqs` (на всех серверах) — playbook 00, hosts: static
Цель: подготовить узлы к присоединению Deckhouse-CAPS (CAPS сам ставит containerd/kubelet через bashible, но ОС-предпосылки должны быть).
- `swapoff` (продублировать cloud-init, идемпотентно), убрать swap из fstab.
- sysctl (`templates/99-k8s.conf.j2`): `net.ipv4.ip_forward=1`, `net.bridge.bridge-nf-call-iptables=1`, `fs.inotify.max_user_instances=8192`, `vm.max_map_count=262144`; загрузить модули `br_netfilter`, `overlay` (`ansible.posix.sysctl`, `community.general.modprobe`).
- Открыть внутренний трафик между узлами (если на ОС есть ufw — либо выключить ufw, полагаясь на VK Cloud SG, либо разрешить подсеть `10.20.0.0/24`). **Решение:** ufw disabled, периметр — VK Cloud SG (§6, `network.tf`).
- Для узлов роли `ai`: установить NVIDIA-драйвер? — **НЕТ вручную**; GPU Operator/Deckhouse-модуль поставит. Только убедиться, что GPU виден: `lspci | grep -i nvidia`.
**Verify:** `sysctl net.bridge.bridge-nf-call-iptables` = 1 на всех; на `ai`: `lspci` показывает NVIDIA.

### 8.3 role `deckhouse_bootstrap` (control host) — playbook 01, run_once
Цель: поднять control-plane Deckhouse EE (Hybrid) через контейнер `dhctl`.
Таски:
1. Отрендерить `infra/deckhouse/config.prod.yml` из `config.prod.yml.example` (§9) с подстановкой: `registryDockerCfg` (из `vault_deckhouse_license`), `sshPublicKey`, OpenStack creds (`vault_os_password` и т.д.), `publicDomainTemplate: "%s.{{ ktc_domain }}"`, `masterNodeGroup.replicas: {{ ktc_master_count }}`, network из terraform output (`internalNetworkName`, `externalNetworkName`).
2. `docker login registry.deckhouse.io -u license-token -p {{ vault_deckhouse_license }}`.
3. Запустить `dhctl bootstrap` (использовать существующий `infra/deckhouse/scripts/bootstrap.sh` как основу, но неинтерактивно):
   ```
   docker run --rm -v $CONFIG:/config.yml -v $PWD/dhctl-tmp:/tmp/dhctl -v ~/.ssh:/tmp/.ssh:ro \
     registry.deckhouse.io/deckhouse/ee/install:stable \
     dhctl bootstrap --ssh-user=ubuntu --ssh-agent-private-keys=/tmp/.ssh/ktc_ed25519 --config=/config.yml
   ```
   (Bootstrap сам создаёт master-ВМ в OpenStack, ставит Deckhouse, привязывает FIP к master.)
4. Забрать kubeconfig: `dhctl` печатает или взять с master `~/.kube/config`; сохранить в `{{ kubeconfig_path }}`; заменить server на master FIP.
**Verify:** `d8 k get nodes` (или `kubectl --kubeconfig ... get nodes`) — master(ы) `Ready`; `kubectl get deckhousereleases` — есть релиз; `kubectl -n d8-system get pods` — deckhouse `Running`.
**Идемпотентность:** если кластер уже есть (kubeconfig валиден и `get nodes` ок) — пропустить bootstrap (`when:` guard).

### 8.4 role `deckhouse_static_nodes` (control host) — playbook 02, run_once
Цель: адаптировать N статических worker-серверов (app/sim/ai/db) в кластер через **CAPS**.
Таски (через `kubernetes.core.k8s`, apply манифестов из `templates/`):
1. `SSHCredentials` (namespace-less, `deckhouse.io/v1alpha1`): base64 приватного ключа `ktc_ed25519`, `user: ubuntu`, `sudoPassword` не нужен (NOPASSWD).
   ```yaml
   apiVersion: deckhouse.io/v1alpha1
   kind: SSHCredentials
   metadata: { name: ktc-ssh }
   spec:
     user: ubuntu
     privateSSHKey: "{{ lookup('file','~/.ssh/ktc_ed25519') | b64encode }}"
   ```
2. По одному `StaticInstance` на каждый worker-хост из inventory (цикл по группам app/sim/ai/db), label `ktc-role: <role>`:
   ```yaml
   apiVersion: deckhouse.io/v1alpha1
   kind: StaticInstance
   metadata:
     name: "{{ item.name }}"
     labels: { ktc-role: "{{ item.role }}" }
   spec:
     address: "{{ item.ip }}"            # приватный IP из inventory
     credentialsRef: { kind: SSHCredentials, name: ktc-ssh }
   ```
3. По одному `NodeGroup` (`nodeType: Static`) на роль, из `infra/deckhouse/nodegroups/static-<role>.yaml`:
   ```yaml
   apiVersion: deckhouse.io/v1
   kind: NodeGroup
   metadata: { name: app }              # app|sim|ai|db
   spec:
     nodeType: Static
     staticInstances:
       count: {{ ktc_app_count }}
       labelSelector: { matchLabels: { ktc-role: app } }
     nodeTemplate:
       labels: { ktc.role: app }
       # для sim/ai добавить taints:
       # taints: [{ key: sim, value: "true", effect: NoSchedule }]
   ```
   Для `sim`: taint `sim=true:NoSchedule`, label `ktc.role=sim`. Для `ai`: taint `ai=true:NoSchedule`, label `ktc.role=ai`. Для `db`: label `ktc.role=db`.
4. Ждать: `kubernetes.core.k8s_info` пока все `StaticInstance` в `phase: Running` и `kubectl get nodes` показывает N узлов `Ready` с нужными label.
**Verify:** `kubectl get staticinstances` → все `Running`; `kubectl get nodes -L ktc.role` показывает app/sim/ai/db в нужном количестве; `kubectl describe node <sim>` содержит taint `sim=true`.
**Частая ошибка:** CAPS не может зайти по SSH → проверить, что control-plane имеет сетевую доступность до приватных IP worker-ов (та же подсеть/SG), и ключ совпадает.

### 8.5 role `deckhouse_modules` (control host) — playbook 03, run_once
Цель: применить prod-ModuleConfig (§10). Apply всех `infra/deckhouse/modules/*.prod.yaml` через `k8s`. Дождаться готовности: ingress-controller, istio, cert-manager, monitoring, cloud-provider-openstack.
**Verify:** `kubectl get mc` (moduleconfigs) — нужные `Enabled`; `kubectl -n d8-ingress-nginx get svc` — LoadBalancer получил `<FIP>`; `kubectl -n d8-istio get pods` Running; `kubectl get clusterissuer letsencrypt` — Ready.

### 8.6 role `cluster_baseline` (control host) — playbook 04, run_once
Цель: namespaces + политики безопасности (§12).
- Apply `infra/namespaces/ktc.yaml` [есть] (istio-injection на app/sim/ai).
- `imagePullSecret` (GHCR PAT из vault) в каждый ktc-namespace (`kubernetes.core.k8s` type `kubernetes.io/dockerconfigjson`).
- PodSecurity: label namespaces `pod-security.kubernetes.io/enforce=baseline` (data/infra), `restricted` (app где возможно). 
- `ResourceQuota` + `LimitRange` на ktc-app/ktc-sim/ktc-ai (из `templates/quota-*.yaml.j2`).
- Istio `PeerAuthentication` STRICT mTLS в mesh-namespaces; `AuthorizationPolicy` «внутренние сервисы принимают трафик только от gw / только от orchestrator» (матрица §12.2).
- `NetworkPolicy` по матрице §12.1.
- Secrets приложений из vault: `ktc-app-secrets` (JWT signing key, TOTP key), `ktc-data-secrets` (Picodata пароль, S3 keys, NATS creds).
**Verify:** `kubectl get netpol -A`, `kubectl get peerauthentication -A`, `kubectl get resourcequota -A` не пусты; `kubectl -n ktc-app get secret ktc-app-secrets` есть.

### 8.7 role `edge_tls` (control host) — playbook 05, run_once
Цель: домен + сертификаты + внешний вход (§11).
- Вывести в лог инструкцию по DNS (создать A `<DOMAIN>`→`<FIP>` и, при wildcard, делегировать/токен DNS-01). Ждать DNS: таск `community.general.dig`/`command: dig` пока `<DOMAIN>` резолвится в `<FIP>` (retry).
- `ClusterIssuer letsencrypt` — включён модулем cert-manager (§8.5). Для wildcard — доп. `ClusterIssuer` c DNS-01 webhook (§11.3).
- `Certificate` для wildcard `*.{{ ktc_domain }}` + apex → secret `ktc-tls` в `ktc-app` (или использовать per-Ingress аннотацию `cert-manager.io/cluster-issuer`).
- Apply `infra/istio/ingress-gw.yaml` [есть] (обновить host на `{{ ktc_domain }}`, `api.{{ ktc_domain }}`), redirect 80→443.
**Verify:** `curl -I https://{{ ktc_domain }}/healthz` → `200`, сертификат валиден (`openssl s_client` показывает Let's Encrypt, не staging при `ktc_letsencrypt_prod: true`); `kubectl get certificate -A` → `Ready=True`.

### 8.8 role `data_layer` (control host) — playbook 06, run_once
Цель: развернуть data-plane в `ktc-data`/`ktc-infra` (§13).
- `helm upgrade --install data-layer deploy/data-layer -n ktc-data -f values-prod` с prod-параметрами: Picodata `replicas: 3` (Raft), Radix (или Redis) `1`, NATS JetStream `3`, MinIO `enabled: false` (S3 нативный VK Cloud), storageClassName = Cinder CSI (из cloud-provider, узнать `kubectl get sc`).
- Init: buckets создаём в VK Cloud S3 Terraform-ом (§6, `s3.tf`) — здесь только проверяем доступность; NATS-стримы (`REPORT_TASKS/AI_TASKS/SESSION_EVENTS/ASSESSMENT_EVENTS`) — Job из `templates/nats-init.yaml` (переиспользовать `infra/local/init/nats/init-streams.sh`).
**Verify:** `kubectl -n ktc-data get sts picodata` → `3/3`; `kubectl exec picodata-0 -- ... psql 'SELECT 1'` ок; NATS `kubectl -n ktc-infra exec ... nats stream ls` показывает 4 стрима; S3 `aws --endpoint {{ ktc_s3_endpoint }} s3 ls` показывает бакеты.

### 8.9 role `db_migrations` (control host) — playbook 07, run_once
Цель: применить централизованные SQL-миграции (`db/migrations/`, 0001..0600) к Picodata.
- Собрать/использовать образ `tools/migrator` (golang-migrate, есть `infra/local/migrator/Dockerfile`); запушить в registry как `{{ ktc_image_registry }}/migrator:{{ ktc_image_tag }}`.
- Запустить K8s `Job` `ktc-migrate` в `ktc-data` с `command: ["up","-dsn","postgres://admin:<pw>@picodata.ktc-data.svc:4327/postgres?sslmode=disable","-migrations","/migrations"]`, миграции — из ConfigMap или из образа (COPY db/migrations). Пароль — из `ktc-data-secrets`.
- Дождаться `Job` `Complete`.
**Verify:** Job `Succeeded`; `migrator version` = последняя (0600); `psql \dt` показывает таблицы (users, component_types, scenarios, sessions, snapshots, reports, ...).

### 8.10 role `app_deploy` (control host) — playbook 08, run_once
Цель: развернуть все 12 сервисов через umbrella-chart (§14).
- Предусловие: образы всех сервисов собраны и в registry под `{{ ktc_image_tag }}` (CI, §14.3). Роль проверяет доступность образов (`skopeo inspect` или `helm template` + dry-run).
- `helm upgrade --install ktc deploy/umbrella -n ktc-app -f deploy/umbrella/values-prod.yaml \
    --set global.imageRegistry={{ ktc_image_registry }} --set global.imageTag={{ ktc_image_tag }} \
    --set global.domain={{ ktc_domain }}`.
- Порядок внутри chart через Helm hooks/weights: сначала `sim-manager` (нужен RBAC на создание sim-worker Pod в ktc-sim), затем backend, `gw`, `fe` последними.
**Verify:** `kubectl -n ktc-app get deploy` — все `Available` (auth/constructor/scenario/orchestrator/assessment/snapshot/report/gw/fe); `kubectl -n ktc-sim get deploy sim-manager`; `kubectl -n ktc-ai get deploy ai`; `curl https://{{ ktc_domain }}/api/v1/auth/login -d '{...}'` → не 503.

### 8.11 role `seeds` (control host) — playbook 09, run_once
Цель: наполнить демо-контентом (`FR-LIB-02`, `FR-TMPL-09`, `FR-SCEN-08`, `FR-SNAP-03`).
- Job/скрипт, использующий seeds из `services/go/constructor/seeds` и `services/go/scenario/seeds`: загрузить 24 типа компонентов КТС, демо-шаблон (фрагмент ЭЛОУ-АВТ), ≥5 сценариев (FR-AV-01..05), ≥3 стартовых пресета.
- Загрузка через внутренние REST (`constructor`/`scenario`) сервис-джобом внутри mesh, либо прямым SQL/seed-loader. Идемпотентно (upsert по id).
**Verify:** `GET /api/v1/components` (через gw с admin-токеном) → ≥24; `GET /api/v1/templates` → ≥1 published; `GET /api/v1/scenarios` → ≥5; пресетов ≥3.

### 8.12 role `observability` (control host) — playbook 10, run_once
Цель: наблюдаемость (§SRD 19, INFRASTRUCTURE §9).
- Deckhouse `monitoring`/`prometheus` уже включён (§10) с `longtermRetentionDays` prod (напр. 30). 
- Fluent Bit — модуль `log-shipper` Deckhouse (ModuleConfig) → в Пульт/Графиню (внешние datasource).
- GPU: DCGM-exporter (через GPU Operator) → метрики util/VRAM.
- Дашборды (GrafanaDashboardDefinition / ConfigMap): tick-lag, активные сессии, WS-соединения, save/restore, GPU, Raft Picodata, NATS streams, HTTP-коды gw.
- Алерты (CustomPrometheusRules): Picodata Raft down, tick-lag > порог, GPU OOM, cert expiry < 14d.
**Verify:** `kubectl get grafanadashboarddefinition -A` (или ConfigMap) не пусто; таргеты Prometheus по `/metrics` сервисов — `up=1`.

### 8.13 role `smoke_tests` (control host) — playbook 11, run_once
Цель: E2E-проверка (см. §15). Роль выполняет `uri`-таски:
1. `GET https://{{ ktc_domain }}/healthz` = 200, TLS валиден.
2. `POST /api/v1/auth/login` (admin/instructor/operator из seed или LDAP-stub) → JWT.
3. `POST /api/v1/sessions` (instructor) → 201; `POST /sessions/{id}/start` → 200.
4. WS: подключиться `wss://{{ ktc_domain }}/api/v1/ws/sessions/{id}/operator?token=...`, получить ≥1 `telemetry` за 3 c.
5. RBAC negative: operator дергает admin-эндпоинт → 403.
6. Failover: (опц., деструктивно) убить `picodata-0` → через <30 c `SELECT 1` снова ок.
**Verify:** все шаги зелёные; отчёт в лог.

## 9. Production Deckhouse `config.prod.yml` (§8.3 использует)

Отличия от teststand `config.yml.example` [есть]:
- `masterNodeGroup.replicas: 3` (HA control-plane, `NFR-REL-01`).
- `releaseChannel: Stable` (prod), окна обновлений (см. Day-2).
- `publicDomainTemplate: "%s.{{ ktc_domain }}"`, `https.mode: CertManager` + `clusterIssuerName: letsencrypt` (уже в примере).
- `global.modules.storageClass` — дефолтный Cinder CSI (`kubectl get sc` после cloud-provider).
- Секреты (`registryDockerCfg`, OpenStack `password`) — только через Ansible-render из vault, **не коммитить** заполненный `config.prod.yml` (в `.gitignore`, как `config.yml`).
- В Hybrid `nodeGroups:` из config можно оставить пустым — worker-узлы приходят статически (§8.4). В config держим только `masterNodeGroup`.

Полный prod-config = teststand-пример с правками выше. Executor: скопировать `config.yml.example` → `config.prod.yml.example`, внести правки, добавить в `.gitignore` `infra/deckhouse/config.prod.yml`.

## 10. Production ModuleConfig (§8.5 применяет) — `infra/deckhouse/modules/*.prod.yaml`

| Модуль | Prod-настройки |
|---|---|
| `deckhouse` | `releaseChannel: Stable`, `update.windows` (окна обновлений, напр. ночь) |
| `global` | `publicDomainTemplate`, `https.mode: CertManager`, `modules.storageClass: <cinder-sc>` |
| `cni-cilium` | enabled (NetworkPolicy-совместимо) |
| `cloud-provider-openstack` | из OpenStack creds — даёт LoadBalancer + Cinder CSI |
| `ingress-nginx` | `inlet: LoadBalancer`, `loadBalancer.annotations: {loadbalancer.openstack.org/floating-ip: "<FIP>"}` (привязка к Terraform FIP); `hsts: true` |
| `istio` | enabled; **strict mTLS** (globalPeerAuthentication) для mesh-namespaces; Ingress Gateway |
| `cert-manager` | enabled; для wildcard — доп. DNS-01 webhook (§11.3) |
| `monitoring`/`prometheus` | `longtermRetentionDays: 30`; storageClass; retention prod |
| `log-shipper` | Fluent Bit → внешние Пульт/Графиня |
| `node-manager` | CAPS для static-узлов (включается автоматически при NodeGroup Static) |
| `descheduler`/`pod-reloader` | опц. |
| GPU: `node-manager` + GPU Operator | для `ai` NodeGroup: NVIDIA device plugin, DCGM (по инструкции VK Cloud/Deckhouse) |

Пример `ingress-nginx.prod.yaml` (привязка FIP):
```yaml
apiVersion: deckhouse.io/v1alpha1
kind: ModuleConfig
metadata: { name: ingress-nginx }
spec:
  enabled: true
  version: 1
  settings:
    inlet: LoadBalancer
    loadBalancer:
      annotations:
        loadbalancer.openstack.org/floating-ip: "<FIP>"   # подставить из terraform output
    hstsOptions: { maxAge: 31536000 }
```

## 11. Домен, сертификаты, edge (детально — исполнителю)

### 11.1 DNS-записи (создать у регистратора/в VK Cloud DNS)
| Тип | Имя | Значение | Зачем |
|---|---|---|---|
| A | `{{ ktc_domain }}` (apex) | `<FIP>` | основной вход |
| A | `api.{{ ktc_domain }}` | `<FIP>` | (опц.) отдельный host для API |
| A | `*.{{ ktc_domain }}` | `<FIP>` | wildcard для поддоменов Deckhouse (grafana., etc), **если** делаем wildcard-TLS |
| CAA | `{{ ktc_domain }}` | `0 issue "letsencrypt.org"` | ограничить выпуск LE |

TTL 300 на время настройки. Дождаться распространения (`dig +short <DOMAIN>` = `<FIP>`).

### 11.2 TLS вариант A — HTTP-01 (проще, без wildcard) — по умолчанию для MVP-prod
- `ClusterIssuer letsencrypt` из коробки (модуль cert-manager). 
- В `Ingress`/Certificate перечислить конкретные хосты (`{{ ktc_domain }}`, `api.{{ ktc_domain }}`).
- Работает, т.к. 80/443 открыты на FIP (SG в `network.tf` уже разрешает 80 для ACME).
- Для отладки сначала `ktc_letsencrypt_prod: false` (staging issuer), убедиться в получении, затем prod (иначе LE rate-limit).

### 11.3 TLS вариант B — DNS-01 (нужен для wildcard `*.<DOMAIN>`)
VK Cloud DNS нет во встроенных провайдерах cert-manager → нужен **webhook**:
- Если DNS у Cloudflare/Route53/Google — использовать встроенную поддержку (настроить `cert-manager` module settings, ClusterIssuer появится сам).
- Если DNS у российского провайдера — развернуть соответствующий `cert-manager-webhook-*` в `d8-cert-manager`, создать `ClusterIssuer` с `solvers.dns01.webhook` + Secret с `vault_dns_api_token` (пример структуры — §WebSearch Yandex Cloud DNS). 
- `Certificate` c `commonName: "*.{{ ktc_domain }}"`, `dnsNames: ["*.{{ ktc_domain }}", "{{ ktc_domain }}"]`, `issuerRef` на этот ClusterIssuer, `secretName: ktc-tls`.

**Рекомендация исполнителю:** начать с варианта A (HTTP-01, точечные хосты) — гарантированно работает; wildcard (B) включать только если реально нужны поддомены.

### 11.4 Внешний вход и WS/gRPC
- Поток: `Клиент → FIP → OpenStack LB → ingress-nginx (TLS termination) → Service gw (Angie) → апстримы (mTLS Istio)`.
- WS (`/api/v1/ws/...`): в `infra/istio/ingress-gw.yaml` уже стоят `proxy-read/send-timeout: 3600` и `websocket-services: gw`. Проверить, что Angie-конфиг gw проксирует WS (в prod gw — это Go-BFF или Angie? В репо `deploy/charts/gw` — Angie-заглушка; прод gw = Go-сервис `services/go/gw`. **Использовать Go-gw** как основной BFF, Angie-chart — только если выбран nginx-BFF. Зафиксировать: prod gw = `services/go/gw` образ.)

## 12. Безопасность кластера (роль cluster_baseline)

### 12.1 NetworkPolicy-матрица (Ingress; default-deny в каждом ktc-ns)
| Namespace/сервис | Принимает от | Исходящий к |
|---|---|---|
| `gw` (ktc-app) | ingress-nginx (edge) | auth, constructor, scenario, orchestrator, assessment, snapshot, report, fe |
| `auth` | gw | picodata, radix |
| `constructor` | gw, scenario, orchestrator | picodata, S3 |
| `scenario` | gw, orchestrator | picodata, constructor |
| `orchestrator` | gw | sim(ktc-sim), constructor, scenario, assessment, snapshot, ai(ktc-ai), nats, picodata, radix |
| `assessment` | gw, orchestrator | picodata, ai, nats |
| `snapshot` | gw, orchestrator | picodata, S3 |
| `report` | gw, orchestrator, nats | picodata, S3, nats |
| `sim-*` (ktc-sim) | orchestrator | — (нет egress в OT, `FR-ISO-*`) |
| `ai` (ktc-ai) | orchestrator, assessment | **egress запрещён** (изолированный SA) |
| `picodata/radix/nats/minio` (ktc-data/infra) | только сервисы-потребители | — |
| default | deny all | deny all кроме перечисленного |

Реализация: `templates/netpol-<ns>.yaml.j2`, применяются ролью. Плюс default-deny NetworkPolicy на каждый ns.

### 12.2 Istio mTLS + AuthorizationPolicy
- `PeerAuthentication` STRICT в `ktc-app/ktc-sim/ktc-ai` (mТLS обязателен, `NFR-SEC-06`).
- `AuthorizationPolicy`: внутренние сервисы принимают только от `gw` SA (кроме sim/ai — только от `orchestrator` SA). Клиентские заголовки `X-User-ID`/`X-Roles` стираются на gw (это уже в логике gw, но задокументировать).

### 12.3 PodSecurity, ресурсы, секреты
- PodSecurity `restricted` где возможно (nonroot — образы Go distroless nonroot, Python uid 10001 — совместимо).
- ResourceQuota/LimitRange per-ns (не дать одной сессии съесть узел).
- Секреты — из `ansible-vault` в K8s Secret; в git только зашифрованное. GHCR imagePullSecret во всех ktc-ns.

## 13. Data-layer prod (расширить `deploy/data-layer`)

Текущий chart [есть] поднимает Picodata `replicas:1`. Для prod:
- **Picodata Raft `replicas: 3`**: StatefulSet уже поддерживает (advertise по `$(POD).picodata`); задать `replication_factor`/init-конфиг кластера (проверить, что 3 инстанса образуют Raft; при необходимости добавить `PICODATA_PEER`/init-скрипт для join). PVC `high-iops` через Cinder SC. podAntiAffinity по `ktc.role=db` узлам (разные ноды).
- **Radix**: при наличии лицензии — образ Picodata Radix; иначе `redis:7.4-alpine` под тем же DNS `radix:7379`/`RADIX_URL`.
- **NATS JetStream `replicas: 3`** с PV (кластерный режим, Raft JetStream) — расширить `values`/шаблон (сейчас single). Стримы — init-Job.
- **S3**: `minio.enabled: false` (нативный VK Cloud S3); бакеты созданы Terraform (`s3.tf`). Сервисы `snapshot`/`report`/`constructor` получают `S3_ENDPOINT={{ ktc_s3_endpoint }}`, ключи из `ktc-data-secrets`, `use_ssl: true`.
**Verify:** см. §8.8.

## 14. Helm-чарты приложений (создать — сейчас только gw+data-layer)

### 14.1 Базовый шаблон `deploy/charts/_service/`
Один параметризуемый chart для типового Go/Python сервиса. `values.yaml` ключи:
```yaml
name: auth
image: { repository: "", tag: "", pullPolicy: IfNotPresent }
namespace: ktc-app
replicaCount: 2
containerPort: 8080
grpcPort: 0            # 50051/50052 для sim/snapshot/ai
env: []               # список name/value или valueFrom secretKeyRef
envFromSecret: ""      # имя Secret (ktc-app-secrets / ktc-data-secrets)
configToml: ""         # монтируемый config.toml (ConfigMap)
resources: { requests: {cpu: 100m, memory: 128Mi}, limits: {cpu: "1", memory: 512Mi} }
nodeSelector: { ktc.role: app }
tolerations: []        # для sim/ai — соответствующий taint
hpa: { enabled: true, min: 2, max: 6, cpu: 70 }
pdb: { enabled: true, minAvailable: 1 }
probes: { readyPath: /readyz, livePath: /healthz }
serviceAccount: ""     # sim-manager нужен SA c правами создавать Pod в ktc-sim
```
Шаблоны: `deployment.yaml`, `service.yaml` (+ gRPC port если задан), `configmap.yaml` (config.toml), `hpa.yaml`, `pdb.yaml`, `serviceaccount.yaml`(+Role/RoleBinding для sim-manager). Образ Go distroless nonroot (как `services/go/auth/deploy/Dockerfile`), Python — как `services/python/ai/Dockerfile`.

### 14.2 Umbrella `deploy/umbrella/`
`Chart.yaml` с `dependencies` — по одному на сервис (alias) на базовый `_service` chart, плюс namespace-специфика. `values-prod.yaml` задаёт per-service: image tag, env (DSN/NATS/REDIS/S3 из секретов), nodeSelector/tolerations, ns.

Соответствие сервис → namespace / порт / зависимости (из репо):
| Сервис | ns | порт | ключевые env |
|---|---|---|---|
| auth | ktc-app | 8080 | AUTH_DB_DSN, AUTH_JWT_SIGNING_KEY, AUTH_TOTP_ENCRYPTION_KEY |
| gw | ktc-app | 8080 | GW_AUTH_URL, upstreams (config.toml) |
| constructor | ktc-app | 8080 | CONSTRUCTOR_DB_DSN, S3 |
| scenario | ktc-app | 8080 | SCENARIO_DB_DSN |
| orchestrator | ktc-app | 8080 | ORCHESTRATOR_DB_DSN, _NATS_URL, _REDIS_ADDR, sim_url, snapshot_url |
| assessment | ktc-app | 8080 | ASSESSMENT_DB_DSN |
| snapshot | ktc-app | 8080 (+gRPC 50052) | SNAPSHOT_DB_DSN, SNAPSHOT_S3_* |
| report | ktc-app | 8080 | REPORT_DB_DSN, REPORT_NATS_URL |
| fe | ktc-app | 8080 | статика (Angie); VITE_API_BASE_URL пустой (относительный) |
| sim-manager | ktc-sim | gRPC | K8s API RBAC (создание sim-worker Pod), taint sim |
| sim-engine (sim-worker) | ktc-sim | gRPC 50051 | per-session (создаётся sim-manager), taint sim |
| ai | ktc-ai | 8080/gRPC 50051 | GPU nodeSelector+toleration, egress deny |

> `sim-worker` не деплоится как Deployment — его Pod создаёт `sim-manager` на сессию. В chart для sim-manager задать образ sim-engine (`{{ registry }}/sim-engine:{{ tag }}`) как параметр, RBAC (ServiceAccount + Role: pods create/delete в ktc-sim), лимиты пода-воркера.

### 14.3 Сборка образов (предусловие app_deploy)
CI (`.github/workflows/*` [есть go/python/frontend]) расширить job `build-and-push`: matrix по всем сервисам → `{{ registry }}/<svc>:{{ tag }}`. Либо роль `app_deploy` перед деплоем делает локальный build+push (медленно). **Рекомендация:** отдельный `.github/workflows/release.yml` собирает и пушит образы по git-тегу `vX.Y.Z`, а Ansible деплоит этот тег (`ktc_image_tag`).

## 15. Критерии приёмки production (маппинг на SRD)

1. `terraform apply` идемпотентно создаёт N ВМ + сеть + FIP + S3; inventory сгенерирован.
2. `ansible-playbook site.yml` проходит целиком без ошибок; повторный запуск — `changed=0` на неизменных ролях (идемпотентность).
3. `kubectl get nodes -L ktc.role`: 3 master `Ready` + app/sim/ai/db в заданном количестве, taints на sim/ai.
4. `https://{{ ktc_domain }}` открывается с валидным Let's Encrypt (TLS 1.2+), наружу открыт только 80/443 на FIP (`NFR-SEC-01`).
5. mTLS STRICT в mesh, NetworkPolicy default-deny, ai egress запрещён (`NFR-SEC-06`, `FR-ISO-*`).
6. Data-plane: Picodata Raft 3/3 (`SELECT 1`), failover primary < 30 c (`NFR-REL-01`, `TEST-07`); NATS 4 стрима; S3 бакеты доступны.
7. Миграции применены (version=0600), seed: ≥24 компонента, ≥1 шаблон, ≥5 сценариев, ≥3 пресета (`FR-TMPL-09`, `FR-SCEN-08`).
8. Smoke E2E: login (3 роли) → session → телеметрия 1 Гц по WSS → RBAC negative 403 (`TEST-03/11`, `NFR-PERF-02`).
9. GPU-узел виден (`nvidia.com/gpu`), `ai` шедулится на него, деградация при kill ai (`FR-AI-01`, `NFR-REL-03`).
10. Наблюдаемость: Prometheus targets `up`, дашборды tick-lag/WS/GPU/Raft, алерты заведены.

## 16. Day-2: эксплуатация, обновления, бэкапы, откаты

### 16.1 Обновления
| Что | Как |
|---|---|
| Облако (N серверов/сеть/FIP/S3) | правка `env/prod.tfvars` (counts/flavors) → `terraform apply` → новые static-ВМ → `ansible-playbook site.yml --tags nodes` (CAPS адаптирует) |
| Версия Deckhouse | release channel в `deckhouse` ModuleConfig, окна обновлений (автокат) |
| Версия K8s | `kubernetesVersion` (rolling upgrade DKP) |
| Приложения (новый релиз) | git-тег `vX.Y.Z` → CI build/push → `ansible-playbook site.yml --tags apps -e ktc_image_tag=vX.Y.Z` |
| Data-layer | bump версии/replicas в `deploy/data-layer/values-prod` → `--tags data` |

### 16.2 Масштабирование N серверов
- Больше сессий → увеличить `sim_count` (Terraform) + `--tags nodes` (новые sim-узлы), HPA sim-manager/orchestrator.
- Больше нагрузки app → `app_count` вверх + HPA.
- GPU → `ai_count` вверх (нужна квота).

### 16.3 Бэкапы
- tfstate — S3 versioning (включить backend в `providers.tf`).
- Picodata — CronJob дамп/Raft-снапшот в S3 (создать; хранение 365 дней — ИБ).
- S3-бакеты — versioning + lifecycle.
- Deckhouse control-plane (etcd) — штатный механизм DKP.

### 16.4 Откаты
- Приложения: `helm rollback ktc <REV> -n ktc-app` (или `--tags apps` с прошлым тегом).
- Инфра: `terraform apply` на прошлый стейт; Deckhouse — только вперёд по каналам.

### 16.5 Опция GitOps (Argo CD) — Day-2
Если позже нужен pull-деплой: развернуть Argo CD (роль/чарт), `Application` на `deploy/umbrella` + `deploy/gitops/prod/values.yaml`; тогда Ansible-роль `app_deploy` заменяется на «bump тега в git». Совместимо с этим планом (тот же umbrella-chart).

## 17. Риски и решения

| Риск | Митигация |
|---|---|
| Deckhouse на VK Cloud = только EE | взять EE-лицензию; fallback Managed K8s VK Cloud (зафиксировать как отступление) |
| CAPS не заходит по SSH на статические узлы | одна подсеть/SG control-plane↔worker; корректный ключ в SSHCredentials; `PasswordAuthentication no` + NOPASSWD sudo для ubuntu |
| Static-only без cloud-provider = нет LB/CSI | использовать **Hybrid** (D1); либо MetalLB + FIP-на-узел + local-path/ручной PV (Приложение A) |
| GPU-квота/flavor VK Cloud недоступны | заранее квоту; временно `ai` на CPU (rule-based), GPU позже; `ai_count` можно 0 (деградация `NFR-REL-03`) |
| Let's Encrypt rate-limit | сначала staging issuer (`ktc_letsencrypt_prod: false`), потом prod |
| Wildcard требует DNS-01 webhook | начать с HTTP-01 точечных хостов (§11.2) |
| Picodata Raft join в StatefulSet | проверить init/peer-конфиг для 3 инстансов; при проблемах — helm-hook init-job формирования кластера |
| Секреты в git | `ansible-vault`/sealed-secrets; `config.prod.yml` в `.gitignore` |
| Дрейф local/teststand/prod | единые env-имена и умбрелла-chart; отличаются только values |
| NATS JetStream single→cluster | явно `replicas:3` + PV + кластерные routes в шаблоне |

## 18. Приложение A — Static-only вариант (если D1-альтернатива)

Если нельзя использовать OpenStack cloud-provider (чистый Static-кластер на N ВМ):
- `clusterType: Static` в `config.prod.yml`; master(ы) тоже static (создать в Terraform, добавить в inventory `[master]`).
- Ingress: модуль `metallb` (L2), пул из 1 адреса = приватный, FIP навесить на узел с speaker; либо `inlet: HostPortWithProxyProtocol` + внешний VK Cloud LB на 80/443 к узлам.
- Storage: нет Cinder CSI → модуль `local-path-provisioner`/`sds-*` или ручные PV на дисках db-узлов (StatefulSet Picodata с `local` volumes + nodeAffinity).
- Всё остальное (роли Ansible, edge, data, apps, seeds) — без изменений.
Это сложнее в эксплуатации; выбирать только при жёстком запрете cloud-provider.

## 19. Финальный чеклист исполнителя (Definition of Done)

- [ ] Фаза 0 чеклист закрыт; vault заполнен и зашифрован.
- [ ] `infra/terraform/{servers,variables.servers,inventory}.tf` + `cloud-init.tftpl` + `env/prod.tfvars` созданы; `apply` прошёл; inventory сгенерирован.
- [ ] `infra/deckhouse/config.prod.yml.example` + `modules/*.prod.yaml` + `nodegroups/static-*.yaml` созданы.
- [ ] `infra/ansible/` со всеми ролями (§8), playbook'ами, group_vars, `site.yml` создан; `ansible all -m ping` ок.
- [ ] `deploy/charts/_service` + 12 сервис-чартов + `deploy/umbrella` + `values-prod.yaml` созданы; `helm template` без ошибок.
- [ ] CI собирает и пушит образы всех сервисов + migrator под `ktc_image_tag`.
- [ ] `ansible-playbook site.yml -J` проходит целиком; повторный запуск идемпотентен.
- [ ] Все 10 критериев приёмки §15 зелёные; smoke-тесты §8.13 пройдены.
- [ ] Day-2 runbook (§16) задокументирован; бэкапы настроены.

---
*Конец плана. Любое несогласие с решениями §2 — правьте таблицу и соответствующие переменные, остальной план от этого не меняется.*
