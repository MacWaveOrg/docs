# infosource

　　Edited: 2026-10-26, 17:00; editor: Sha0huaZhang

## 1. Basic Information

| Item | Content | Note |
| --- | --- | --- |
| Remote repository | <https://github.com/MacWaveOrg/infosource> | Protected repository |
| Owner | Sha0huaZhang, <https://github.com/Sha0huaZhang> | |
| Old branch | <https://github.com/MacWaveOrg/MacWave/tree/legacy-infosource> | Archived and abandoned; renamed legacy-infosource — do not push to the old branch |
| Contact | hi@macwave.org (email); <https://github.com/Sha0huaZhang> (GitHub) | |

　　To contribute, clone this repository first:

```bash
mkdir -p ~/src/MacWaveOrg
cd ~/src/MacWaveOrg
git clone https://github.com/MacWaveOrg/infosource.git
```

## 2. Index Format

### A. Package index

　　Here is a real snippet:

　　(arm64 is the same, omitted)

　　Run the following (install the tree package first, e.g. `wave install tree` ; `brew install tree`):

```bash
tree ~/src/MacWaveOrg/infosource
```

　　Output (only some packages and dependencies are listed here):

```text
~/src/MacWaveOrg/infosource
├── deps
│   ├── depsinfo_amd64
│   │   ├── bzip2
│   │   │   ├── _bzip2@1.0.8
│   │   │   └── _bzip2@common
│   │   │   ├── _ncurses@6.4
│   │   │   ├── _ncurses@6.6
│   │   │   └── _ncurses@common
│   │   ├── oniguruma
│   │   │   ├── _oniguruma@6.9.9
│   │   │   └── _oniguruma@common
│   │   ├── openssl
│   │   │   ├── _openssl@3.0.15
│   │   │   └── _openssl@common
│   │   ├── icu
│   │   │   ├── _icu@68.1
│   │   │   └── _icu@common
│   │   ├── pcre2
│   │   │   ├── _pcre2@10.42
│   │   │   └── _pcre2@common
│   │   ├── xz
│   │   │   ├── _xz@5.6.4
│   │   │   └── _xz@common
(...)
├── pkg
│   ├── pkginfo_amd64
│   │   ├── bat
│   │   │   ├── _bat@0.25.0
│   │   │   ├── _bat@0.26.0
│   │   │   ├── _bat@0.26.1
│   │   │   └── _bat@common
│   │   ├── btop
│   │   │   ├── _btop@1.4.5
│   │   │   ├── _btop@1.4.6
│   │   │   ├── _btop@1.4.7
│   │   │   └── _btop@common
│   │   ├── choma
│   │   │   ├── _choma@1.0-macwaveteam2
│   │   │   └── _choma@common
│   │   ├── jq
│   │   │   ├── _jq@1.8.2
│   │   │   └── _jq@common
│   │   │   │   ├── trollrestore
│   │   │   ├── _trollrestore@1.0
│   │   │   └── _trollrestore@common
│   │   └── wget
│   │       ├── _wget@1.25.0
│   │       └── _wget@common
│   │
(omitted)
```

　　Run the following commands:

```bash
cd ~/src/MacWaveOrg/infosource/pkg/pkginfo_amd64/wget
cat _wget@1.25.0
```

　　Output:

```text
sha256: "11c6d0041823aef0b8b764e6820e846d6bb63b4202e24ca4dd94d343d9f271f9"
url: "https://repo.continuum.io/pkgs/main/osx-64/wget-1.25.0-h3a17b82_0.tar.bz2"
deps: "gettext@0.21.0"
      "libiconv@1.16"
      "libidn2@2.3.4"
      "openssl@3.0.15"
      "pcre2@10.42"
      "zlib@1.2.13"
```

　　Run the following commands:

```bash
cd ~/src/MacWaveOrg/infosource/pkg/pkginfo_amd64/bat
cat _bat@0.26.1
```

　　Output:

```text
sha256: "e30beff26779c9bf60bb541e1d79046250cb74378f2757f8eb250afddb19e114"
url: "https://github.com/sharkdp/bat/releases/download/v0.26.1/bat-v0.26.1-aarch64-apple-darwin.tar.gz"
```

　　Comparing the two, the `deps` field is not mandatory. A package gets its dependency information from the `deps` field and downloads them the same way it downloads a package (only into a different directory). When a package needs dependencies the `deps` field exists; when a package needs no dependencies the `deps` field must not exist.

　　`_dependency@version` mainly stores information that changes easily, such as SHA256, URL and dependencies. Each field means the following:

| Field | Meaning | Purpose | Note |
| --- | --- | --- | --- |
| sha256 | The SHA256 value of the package | Compared with the package after download to prevent tampering | Must not be empty or wrong, otherwise the installation is aborted and a warning is raised |
| url | The URL of the package | Used to fetch the package | Must not be empty |
| deps | The dependencies of the package | Yields the names and versions of the dependencies the package needs; they are looked up under the corresponding part of `deps/` and downloaded, see the relevant section below | Must not be empty when there are dependencies, and must be empty when there are none |

　　Run the following commands:

```bash
cd ~/src/MacWaveOrg/infosource/pkg/pkginfo_amd64/wget
cat _wget@common
```

　　Output:

```text
bin_name: "wget"
des: "GNU Wget"
hom: "https://www.gnu.org/software/wget/"
lic: "GPL-3.0"
aut: "GNU Project"
```

　　`_package@common` mainly stores information that rarely changes. Each field means the following:

| Field | Full name | Meaning | Note |
| --- | --- | --- | --- |
| bin_name | Binary Name | The name of the executable binary | Must not be empty |
| des | Description | The description of the package | |
| hom | Homepage | The homepage of the package | |
| lic | License | The license of the package; common ones are MIT, GPL and so on | |
| aut | Author | The author of the package, either a person or an organization | |

### B. Dependency index

　　Run the following commands:

```bash
cd ~/src/MacWaveOrg/infosource/deps/depsinfo_amd64/icu
cat _icu@73.1
```

　　Output:

```text
sha256: "fd87b109deef638ca91abf3972516ed588f6d63a32b809943018dd206d3cf2f1"
url: "https://repo.continuum.io/pkgs/main/osx-64/icu-73.1-hcec6c5f_0.tar.bz2"
deps: "libcxx@17.0.6"
des: "ICU - International Components for Unicode"
hom: "https://icu.unicode.org/"
lic: "Unicode-3.0"
aut: "Unicode Consortium"
dep_name: "icu"
```

　　Run the following commands:

```bash
cd ~/src/MacWaveOrg/infosource/deps/depsinfo_amd64/bzip2
cat _bzip2@1.0.8
```

　　Output:

```text
sha256: "438c40aa11178fe552d6c897b1df6dcee2ba366d27d45756c7fd7ece9c047a1c"
url: "https://repo.continuum.io/pkgs/main/osx-64/bzip2-1.0.8-h6c40b1e_6.tar.bz2"
des: "bzip2 - block-sorting compression library (libbz2)"
hom: "https://sourceware.org/bzip2/"
lic: "BSD-4-Clause"
aut: "Julian Seward"
dep_name: "bzip2"
```

　　This is broadly similar to a package, and comparing them shows that the `deps` field is not mandatory. As we saw earlier, a package gets its dependency information from `deps` and downloads them the same way it downloads a package (only into a different directory). When a dependency still needs other dependencies the `deps` field exists; when it needs none there is no `deps` field. The program handles this recursively.

　　`_dependency@version` mainly stores information that changes easily, such as SHA256, URL and dependencies (if any). Each field means the following:

| Field | Meaning | Purpose | Note |
| --- | --- | --- | --- |
| sha256 | The SHA256 value of the dependency | Compared with the dependency after download to prevent tampering | Must not be empty or wrong, otherwise the installation is aborted and a warning is raised |
| url | The URL of the dependency | Used to fetch the dependency | Must not be empty |
| deps | The dependencies of the dependency | Yields the names and versions of the dependencies the package needs; they are looked up under the corresponding part of `deps/` and downloaded, see the relevant section below | Must not be empty when there are dependencies, and must be empty when there are none |

## 3. Notes

　　After modifying or adding an index, please confirm:

1. `sha256` and `url` point to the same version, and the hash is accurate. Prefer URLs from the upstream official channel; avoid mirrors and third-party download addresses of questionable trustworthiness. Prefer the sha256 provided by the official channel; if it does not exist, download the file completely to your machine and compute the sha256 from the original format provided by the site (do not unpack an archive if one is provided).
2. When there are dependencies the `deps` field must not be empty; when there are none the `deps` field must be empty
3. Some included packages are not the official build but a widely used build, such as ldid v2.1.5-procursus7; or, when the official project provides no pre-built package, a build made by the author or by other team members, such as ChOma v1.0-macwaveteam2

## 4. Contributing

　　Please submit changes through a Pull Request. For bug reports, field disputes or new architecture requirements, file an Issue or contact the maintainer (hi@macwave.org). Do not keep pushing to the old branch.

　　Every day at 17:17 a CI job checks whether any package has a newer version available. If so, it fills in the url, sha256 and other information automatically and opens a Pull Request; please review it and merge once everything is confirmed correct.
