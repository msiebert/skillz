---
name: setup-mixpanel-environment
description: This skill should be used when the user asks to "set up the Mixpanel environment", "install development tools", "set up my dev environment for Mixpanel", "install Just", or mentions Mixpanel environment setup or project tooling installation.
version: 1.0.0
---

# Set Up Mixpanel Environment

This skill provides instructions for setting up the development environment required for Mixpanel projects.

## Prerequisites

Ensure Homebrew is installed before proceeding. If not installed, run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## Install Just

[Just](https://github.com/casey/just) is a command runner used for managing project tasks in Mixpanel projects.

### Installation

Install Just via Homebrew:

```bash
brew install just
```

### Verify Installation

Confirm Just is installed and accessible:

```bash
just --version
```

### Usage

Once installed, run `just` in any project directory containing a `justfile` to see available recipes:

```bash
just --list
```

Execute a specific recipe:

```bash
just <recipe-name>
```

## Install Python Build Dependencies

Several Python packages in the analytics webapp require system-level C libraries to build from source. Install them all at once:

### Installation

```bash
brew install mysql-client llvm libomp libxml2
```

Then build and install `libxmlsec1` 1.2.x from source (Homebrew's 1.3.x is incompatible with the Python `xmlsec==1.3.13` package):

```bash
curl -L -o /tmp/xmlsec1-1.2.41.tar.gz https://github.com/lsh123/xmlsec/releases/download/1.2.41/xmlsec1-1.2.41.tar.gz
cd /tmp && tar xzf xmlsec1-1.2.41.tar.gz && cd xmlsec1-1.2.41
./configure --prefix=/opt/homebrew/opt/libxmlsec1-1.2 --with-openssl=/opt/homebrew/opt/openssl@3 --with-libxml=/opt/homebrew/opt/libxml2 --disable-crypto-dl
make -j$(sysctl -n hw.ncpu)
make install prefix=/opt/homebrew/opt/libxmlsec1-1.2
```

### Environment Variables

Add the following to your `~/.zshrc`:

```bash
# Mixpanel analytics build dependencies
export PATH="/opt/homebrew/opt/libxmlsec1-1.2/bin:/opt/homebrew/opt/mysql-client/bin:/opt/homebrew/opt/llvm/bin:$PATH"
export CC=/opt/homebrew/opt/llvm/bin/clang
export CXX=/opt/homebrew/opt/llvm/bin/clang++
export LDFLAGS="-L/opt/homebrew/opt/mysql-client/lib -L/opt/homebrew/opt/libomp/lib -L/opt/homebrew/opt/llvm/lib -L/opt/homebrew/opt/zstd/lib"
export CPPFLAGS="-I/opt/homebrew/opt/mysql-client/include -I/opt/homebrew/opt/libomp/include -I/opt/homebrew/opt/llvm/include"
export PKG_CONFIG_PATH="/opt/homebrew/opt/mysql-client/lib/pkgconfig:/opt/homebrew/opt/libxmlsec1-1.2/lib/pkgconfig"
```

### What each dependency is for

| Brew package | Required by | Why |
|---|---|---|
| `mysql-client` | `mysqlclient` (Python) | Provides `mysql_config` and client libraries |
| `llvm` | `liblinear-multicore` (Python) | Apple's clang lacks `-fopenmp` support; Homebrew LLVM has it |
| `libomp` | `liblinear-multicore` (Python) | OpenMP runtime library |
| `libxml2` | `xmlsec` (Python) | XML parsing library needed to build libxmlsec1 from source |
| `libxmlsec1` 1.2.x (from source) | `xmlsec==1.3.13` (Python) | Homebrew's `libxmlsec1` 1.3.x removed SOAP constants that the pinned Python package still references |

### Verify Installation

```bash
mysql_config --version
clang --version
xmlsec1-config --version  # should show 1.2.x
```
