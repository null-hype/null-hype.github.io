#!/usr/bin/env bash

set -euo pipefail

TERRAFORM_VERSION="${TERRAFORMVERSION:-1.7.5}"
DAGGER_VERSION="${DAGGERVERSION:-0.13.7}"
MUTAGEN_VERSION="${MUTAGENVERSION:-0.18.1}"
DENO_VERSION="${DENOVERSION:-v2.7.1}"
SMALLWEB_VERSION="${SMALLWEBVERSION:-0.28.4}"
INSTALL_GCLOUD="${INSTALLGCLOUD:-true}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "operator-tools feature must run as root" >&2
  exit 1
fi

. /etc/os-release

if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
  echo "operator-tools only supports Debian and Ubuntu base images" >&2
  exit 1
fi

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  jq \
  openssh-client \
  tar \
  unzip

architecture="$(dpkg --print-architecture)"

case "${architecture}" in
  amd64)
    terraform_arch="amd64"
    mutagen_arch="amd64"
    smallweb_arch="x86_64"
    ;;
  arm64)
    terraform_arch="arm64"
    mutagen_arch="arm64"
    smallweb_arch="arm64"
    ;;
  *)
    echo "unsupported architecture: ${architecture}" >&2
    exit 1
    ;;
esac

install_terraform() {
  local version="$1"
  local archive="terraform_${version}_linux_${terraform_arch}.zip"
  local base_url="https://releases.hashicorp.com/terraform/${version}"
  local temp_dir

  temp_dir="$(mktemp -d)"

  curl -fsSL -o "${temp_dir}/${archive}" "${base_url}/${archive}"
  curl -fsSL -o "${temp_dir}/terraform_SHA256SUMS" "${base_url}/terraform_${version}_SHA256SUMS"
  (
    cd "${temp_dir}"
    grep " ${archive}\$" terraform_SHA256SUMS | sha256sum -c -
    unzip -q "${archive}"
    install -m 0755 terraform /usr/local/bin/terraform
  )
  rm -rf "${temp_dir}"
}

install_dagger() {
  curl -fsSL https://dl.dagger.io/dagger/install.sh \
    | BIN_DIR=/usr/local/bin DAGGER_VERSION="v$1" sh
}

install_mutagen() {
  local version="$1"
  local archive="mutagen_linux_${mutagen_arch}_v${version}.tar.gz"
  local url="https://github.com/mutagen-io/mutagen/releases/download/v${version}/${archive}"
  local temp_dir

  temp_dir="$(mktemp -d)"

  curl -fsSL -o "${temp_dir}/${archive}" "${url}"
  tar -xzf "${temp_dir}/${archive}" -C "${temp_dir}"
  install -m 0755 "${temp_dir}/mutagen" /usr/local/bin/mutagen
  install -m 0644 "${temp_dir}/mutagen-agents.tar.gz" /usr/local/bin/mutagen-agents.tar.gz
  rm -rf "${temp_dir}"
}

install_deno() {
  local version="$1"

  export DENO_INSTALL=/usr/local

  curl -fsSL https://deno.land/install.sh \
    | sh -s -- --no-modify-path "${version}"
}

install_smallweb() {
  local version="$1"
  local archive="smallweb_Linux_${smallweb_arch}.tar.gz"
  local url="https://github.com/pomdtr/smallweb/releases/download/v${version}/${archive}"
  local temp_dir

  temp_dir="$(mktemp -d)"

  curl -fsSL -o "${temp_dir}/${archive}" "${url}"
  tar -xzf "${temp_dir}/${archive}" -C "${temp_dir}" smallweb
  install -m 0755 "${temp_dir}/smallweb" /usr/local/bin/smallweb
  rm -rf "${temp_dir}"
}

install_gcloud() {
  curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list
  apt-get update
  apt-get install -y --no-install-recommends google-cloud-cli
}

install_terraform "${TERRAFORM_VERSION}"
install_dagger "${DAGGER_VERSION}"
install_mutagen "${MUTAGEN_VERSION}"
install_deno "${DENO_VERSION}"
install_smallweb "${SMALLWEB_VERSION}"

if [[ "${INSTALL_GCLOUD}" == "true" ]]; then
  install_gcloud
fi

apt-get clean
rm -rf /var/lib/apt/lists/*
