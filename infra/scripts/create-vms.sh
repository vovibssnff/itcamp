#!/usr/bin/env bash
# Create VK Cloud VMs for Deckhouse + KTC on Astra Linux.
#
# Topology:
#   - one private network (all VMs on it, can talk to each other)
#   - router → external net "internet"
#   - floating (white) IP(s) on selected VMs (default: master-0)
#   - image: Astra Voronezh from glance (this project: astra-vor-1.7-...;
#     display name "Astra Linux SE 1.8 Воронеж" is not present in the catalog)
#
# Prerequisites:
#   source ./mcs1029961928-openrc.sh
#   openstack token issue
#   RSA key (VK Cloud rejects ed25519 keypairs):
#     ssh-keygen -t rsa -b 4096 -f ~/.ssh/ktc_rsa -N ''
#
# Usage:
#   ./infra/scripts/create-vms.sh
#   PREFIX=ktc-dev ./infra/scripts/create-vms.sh
set -euo pipefail

PREFIX="${PREFIX:-ktc}"
AZ="${AZ:-MS1}"
# Exact glance Name from: openstack image list | grep -i astra
IMAGE="${IMAGE:-astra-vor-1.7-202607101244.gitc9ed06de}"
EXT_NET="${EXT_NET:-internet}"
CIDR="${CIDR:-10.20.0.0/24}"
# Nova on VK Cloud: use RSA — ed25519 → "failed to generate fingerprint"
SSH_PUBKEY="${SSH_PUBKEY:-$HOME/.ssh/ktc_rsa.pub}"
KEY_NAME="${KEY_NAME:-${PREFIX}-key}"
# Astra cloud images usually use user "astra" (override if your image differs)
SSH_USER="${SSH_USER:-astra}"

# role:flavor:disk_gb
VMS=(
  "master-0:STD3-8-16:60"
  "app-0:STD3-4-8:50"
  "app-1:STD3-4-8:50"
  "sim-0:STD3-8-16:50"
  "db-0:STD3-4-16:100"
  "db-1:STD3-4-16:100"
)

# Which VMs get a public (white) floating IP — space-separated roles from VMS list
FLOATING_ROLES="${FLOATING_ROLES:-master-0}"

if [[ -z "${OS_AUTH_URL:-}" || -z "${OS_PASSWORD:-}" ]]; then
  echo "OS_* not set. Run: source ./mcs1029961928-openrc.sh" >&2
  exit 1
fi
if [[ ! -f "$SSH_PUBKEY" ]]; then
  echo "missing SSH pubkey: $SSH_PUBKEY" >&2
  echo "  ssh-keygen -t rsa -b 4096 -f ~/.ssh/ktc_rsa -N ''" >&2
  exit 1
fi
if ! grep -qE '^ssh-rsa ' "$SSH_PUBKEY"; then
  echo "ERROR: VK Cloud keypairs need ssh-rsa. Got:" >&2
  head -c 40 "$SSH_PUBKEY"; echo >&2
  echo "  ssh-keygen -t rsa -b 4096 -f ~/.ssh/ktc_rsa -N ''" >&2
  echo "  SSH_PUBKEY=~/.ssh/ktc_rsa.pub ./infra/scripts/create-vms.sh" >&2
  exit 1
fi

echo "==> auth check"
openstack token issue >/dev/null

if ! openstack image show "$IMAGE" &>/dev/null; then
  echo "ERROR: image not found: $IMAGE" >&2
  echo "Astra-related images in this project:" >&2
  openstack image list -f value -c Name | grep -iE 'astra|астра' || echo "  (none)" >&2
  exit 1
fi
echo "==> image: $IMAGE"

echo "==> keypair $KEY_NAME (RSA)"
if openstack keypair show "$KEY_NAME" &>/dev/null; then
  echo "    exists — delete and recreate if it was created with a bad key:"
  echo "    openstack keypair delete $KEY_NAME"
else
  # single-line pubkey; --public-key reads the file
  openstack keypair create --public-key "$SSH_PUBKEY" "$KEY_NAME"
fi

NET_NAME="${PREFIX}-net"
SUBNET_NAME="${PREFIX}-subnet"
ROUTER_NAME="${PREFIX}-router"
SG_NAME="${PREFIX}-sg"

echo "==> private network $NET_NAME ($CIDR) — all VMs join this LAN"
if ! openstack network show "$NET_NAME" &>/dev/null; then
  openstack network create \
    --description "KTC private LAN" \
    "$NET_NAME"
fi

echo "==> subnet $SUBNET_NAME"
if ! openstack subnet show "$SUBNET_NAME" &>/dev/null; then
  openstack subnet create \
    --network "$NET_NAME" \
    --subnet-range "$CIDR" \
    --dns-nameserver 8.8.8.8 \
    --dns-nameserver 1.1.1.1 \
    "$SUBNET_NAME"
fi

echo "==> router $ROUTER_NAME (private LAN → $EXT_NET for SNAT / floating IPs)"
if ! openstack router show "$ROUTER_NAME" &>/dev/null; then
  openstack router create "$ROUTER_NAME"
  openstack router set --external-gateway "$EXT_NET" "$ROUTER_NAME"
  openstack router add subnet "$ROUTER_NAME" "$SUBNET_NAME"
else
  openstack router set --external-gateway "$EXT_NET" "$ROUTER_NAME" 2>/dev/null || true
  openstack router add subnet "$ROUTER_NAME" "$SUBNET_NAME" 2>/dev/null || true
fi

echo "==> security group $SG_NAME"
if ! openstack security group show "$SG_NAME" &>/dev/null; then
  openstack security group create --description "KTC Astra nodes" "$SG_NAME"
  openstack security group rule create --proto tcp --dst-port 22 --ingress "$SG_NAME"
  openstack security group rule create --proto tcp --dst-port 80 --ingress "$SG_NAME"
  openstack security group rule create --proto tcp --dst-port 443 --ingress "$SG_NAME"
  openstack security group rule create --proto tcp --dst-port 6443 --ingress "$SG_NAME"
  openstack security group rule create --proto icmp --ingress "$SG_NAME"
  # full east-west between members of this SG (same private net)
  openstack security group rule create --proto tcp --dst-port 1:65535 --ingress --remote-group "$SG_NAME" "$SG_NAME"
  openstack security group rule create --proto udp --dst-port 1:65535 --ingress --remote-group "$SG_NAME" "$SG_NAME"
fi

USER_DATA=$(mktemp)
trap 'rm -f "$USER_DATA"' EXIT
cat >"$USER_DATA" <<EOF
#cloud-config
# Astra Linux SE cloud-init
users:
  - default
  - name: ${SSH_USER}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - $(cat "$SSH_PUBKEY")
package_update: false
runcmd:
  - swapoff -a || true
  - sed -i '/ swap / s/^/#/' /etc/fstab || true
EOF

echo "==> create VMs on private network $NET_NAME"
for spec in "${VMS[@]}"; do
  IFS=':' read -r role flavor disk <<<"$spec"
  name="${PREFIX}-${role}"
  if openstack server show "$name" &>/dev/null; then
    echo "    skip existing $name"
    continue
  fi
  echo "    create $name ($flavor, ${disk}GB, Astra)"
  openstack server create \
    --image "$IMAGE" \
    --flavor "$flavor" \
    --network "$NET_NAME" \
    --key-name "$KEY_NAME" \
    --security-group "$SG_NAME" \
    --boot-from-volume "$disk" \
    --availability-zone "$AZ" \
    --user-data "$USER_DATA" \
    --property "ktc_role=${role%%-*}" \
    --property "ktc_os=astra" \
    --wait \
    "$name"
done

has_floating() {
  local server=$1
  openstack server show "$server" -f json | python3 -c "
import json,sys
s=json.load(sys.stdin)
addrs=s.get('addresses') or {}
for items in addrs.values():
  if not isinstance(items, list):
    continue
  for a in items:
    if isinstance(a, dict) and a.get('OS-EXT-IPS:type') == 'floating':
      print(a.get('addr','')); sys.exit(0)
    # openstackclient sometimes returns plain strings
sys.exit(1)
" 2>/dev/null || true
}

echo "==> floating (white) IPs for: $FLOATING_ROLES"
for role in $FLOATING_ROLES; do
  name="${PREFIX}-${role}"
  if ! openstack server show "$name" &>/dev/null; then
    echo "    skip $name (not found)"
    continue
  fi
  fip=$(has_floating "$name")
  if [[ -n "${fip:-}" ]]; then
    echo "    $name already has white IP: $fip"
    continue
  fi
  fip=$(openstack floating ip create "$EXT_NET" -f value -c floating_ip_address)
  openstack server add floating ip "$name" "$fip"
  echo "    $name white IP: $fip"
  echo "    SSH: ssh -i ${SSH_PUBKEY%.pub} ${SSH_USER}@${fip}"
done

echo
echo "==> done"
echo "Private LAN: $NET_NAME / $CIDR (all VMs attached)"
echo "Image:       $IMAGE"
echo
openstack server list -c Name -c Status -c Networks -c Flavor
echo
echo "Addresses:"
openstack server list -f json | python3 -c "
import json,sys
for s in json.load(sys.stdin):
  if not str(s.get('Name','')).startswith('${PREFIX}-'):
    continue
  nets=s.get('Networks') or {}
  parts=[]
  for net, v in nets.items():
    ips = v if isinstance(v, list) else [str(v)]
    parts.append(f'{net}={\",\".join(ips)}')
  print(f\"  {s['Name']}: {'; '.join(parts)}\")
"
