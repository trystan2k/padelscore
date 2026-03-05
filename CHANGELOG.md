# Changelog

All notable changes to this project will be documented in this file.

## [1.11.3](https://github.com/trystan2k/padelbuddy/compare/v1.11.2...v1.11.3) (2026-03-03)

### Code Refactoring

* consolidate screen metrics helpers into screen-utils.js ([39b0dad](https://github.com/trystan2k/padelbuddy/commit/39b0dad053864ebacd7b80449d7bd74aac8cc3ab))

## [1.11.2](https://github.com/trystan2k/padelbuddy/compare/v1.11.1...v1.11.2) (2026-03-03)

### Code Refactoring

* split game screen into focused modules and restore interactions ([e9ed7bf](https://github.com/trystan2k/padelbuddy/commit/e9ed7bfbc37207463214a71c499474322dadaf8e))

## [1.11.1](https://github.com/trystan2k/padelbuddy/compare/v1.11.0...v1.11.1) (2026-03-03)

### Code Refactoring

* remove JSON.stringify from hot-path to improve performance ([abdc099](https://github.com/trystan2k/padelbuddy/commit/abdc0998e02283e03e1dcf764f076ab07e2c7253))

## [1.11.0](https://github.com/trystan2k/padelbuddy/compare/v1.10.3...v1.11.0) (2026-03-03)

### Features

* add unification regression suite ([43b409d](https://github.com/trystan2k/padelbuddy/commit/43b409d0f506fa89e70359d445a41efebe977e11))

### Code Refactoring

* consolidate shared constants and validation helpers ([e7d28e1](https://github.com/trystan2k/padelbuddy/commit/e7d28e108bb2f054ff5222050a6a972950d7282a))

## [1.10.3](https://github.com/trystan2k/padelbuddy/compare/v1.10.2...v1.10.3) (2026-03-02)

### Bug Fixes

* stabilize matchStartTime initialization and update storage schema with tests ([09bae8a](https://github.com/trystan2k/padelbuddy/commit/09bae8a00e721e260d720e7c40d08cf356c5d161))

## [1.10.2](https://github.com/trystan2k/padelbuddy/compare/v1.10.1...v1.10.2) (2026-03-02)

### Code Refactoring

* remove globaldata session handoffs with deterministic storage access ([8d24073](https://github.com/trystan2k/padelbuddy/commit/8d240737e48b02f4b8aae6040a9f8d520e0cabc3))

## [1.10.1](https://github.com/trystan2k/padelbuddy/compare/v1.10.0...v1.10.1) (2026-03-02)

### Code Refactoring

* unify app and page session persistence paths ([e56e4d8](https://github.com/trystan2k/padelbuddy/commit/e56e4d89b37f10c14d27b6a309235f4e9cb6a1a7))

## [1.10.0](https://github.com/trystan2k/padelbuddy/compare/v1.9.0...v1.10.0) (2026-03-02)

### Features

* introduce canonical match-session contract and stabilize Zepp runtime flow ([1328d7d](https://github.com/trystan2k/padelbuddy/commit/1328d7d165257fad573040ce2a20161d82aab182))

## [1.9.0](https://github.com/trystan2k/padelbuddy/compare/v1.8.0...v1.9.0) (2026-03-02)

### Features

* implement unified active-session storage service ([76130c6](https://github.com/trystan2k/padelbuddy/commit/76130c6f91ed5d17da413bc8c5f50765b888cbb8))

## [1.8.0](https://github.com/trystan2k/padelbuddy/compare/v1.7.1...v1.8.0) (2026-03-02)

### Features

* add coach-whistle manual finish with 3s confirm and tie-aware summary ([b38bfdc](https://github.com/trystan2k/padelbuddy/commit/b38bfdcfd3c0ca4fcc8ba1a0d5c2658ded9c5302))

## [1.7.1](https://github.com/trystan2k/padelbuddy/compare/v1.7.0...v1.7.1) (2026-03-01)

### Code Refactoring

* **tests:** centralize file path resolution for test imports ([b58c233](https://github.com/trystan2k/padelbuddy/commit/b58c233c1457745cd53c09186548266908d9d707))
* trigger release workflow after successful CI run ([7b7ca8c](https://github.com/trystan2k/padelbuddy/commit/7b7ca8c3df1519340c6526939fdb99175486f756))

## [1.7.0](https://github.com/trystan2k/padelbuddy/compare/v1.6.2...v1.7.0) (2026-02-28)

### Features

* move build step to semantic-release prepareCmd ([acf8103](https://github.com/trystan2k/padelbuddy/commit/acf8103a0af99208fd9aed1a60c19a2905c63e48))

### Code Refactoring

* **app.json:** format permissions array for consistency ([929f025](https://github.com/trystan2k/padelbuddy/commit/929f0255c36d33435d6deb5bd2de4d301a1b9a9c))

## [1.6.2](https://github.com/trystan2k/padelbuddy/compare/v1.6.1...v1.6.2) (2026-02-28)

### Code Refactoring

* **i18n:** consolidate translation keys by removing unused entries ([78562c0](https://github.com/trystan2k/padelbuddy/commit/78562c0de44fd9ca93651dbbcd032ca6cefa912d))

## [1.6.1](https://github.com/trystan2k/padelbuddy/compare/v1.6.0...v1.6.1) (2026-02-28)

### Bug Fixes

* **ui:** adjust row height and swap text colors for better readability ([fefc17e](https://github.com/trystan2k/padelbuddy/commit/fefc17efa81a47d476d15d0e12639975fb05d25f))

### Code Refactoring

* migrate page layouts to shared presets ([0480c44](https://github.com/trystan2k/padelbuddy/commit/0480c445f7e99b0693a10a1caeaf54f624128c1d))
* remove unused UI components and internalize helper functions ([87b1105](https://github.com/trystan2k/padelbuddy/commit/87b110532ed681aa9352cec6a7de184c223b0e0b))

## [1.6.0](https://github.com/trystan2k/padelbuddy/compare/v1.5.0...v1.6.0) (2026-02-28)

### Features

* migrate Settings, History, and History Detail pages to new layout system ([3d5bd7e](https://github.com/trystan2k/padelbuddy/commit/3d5bd7e449a9cdb9c7ea0a522af3a0ea963109d2)), closes [#50](https://github.com/trystan2k/padelbuddy/issues/50)

## [1.5.0](https://github.com/trystan2k/padelbuddy/compare/v1.4.0...v1.5.0) (2026-02-27)

### Features

* migrate summary screen to new layout system ([22a435c](https://github.com/trystan2k/padelbuddy/commit/22a435c0084c4f1dcdf49ac5cf8742176510061e)), closes [#49](https://github.com/trystan2k/padelbuddy/issues/49)

## [1.4.0](https://github.com/trystan2k/padelbuddy/compare/v1.3.0...v1.4.0) (2026-02-26)

### Features

* **game:** migrate game screen to new layout system ([6ce975e](https://github.com/trystan2k/padelbuddy/commit/6ce975e308e5ddbca516267da8d549ea2ca13eb1)), closes [#47](https://github.com/trystan2k/padelbuddy/issues/47)

## [1.3.0](https://github.com/trystan2k/padelbuddy/compare/v1.2.0...v1.3.0) (2026-02-26)

### Features

* migrate setup screen to new layout system ([13668e3](https://github.com/trystan2k/padelbuddy/commit/13668e3da979146bd6df63d21addb50cc7a2adbb)), closes [#46](https://github.com/trystan2k/padelbuddy/issues/46)

## [1.2.0](https://github.com/trystan2k/padelbuddy/compare/v1.1.0...v1.2.0) (2026-02-26)

### Features

* migrate home screen to new layout system ([976486a](https://github.com/trystan2k/padelbuddy/commit/976486acc1ef639e1b4557a3402bb7afe18cc40e)), closes [#45](https://github.com/trystan2k/padelbuddy/issues/45)

## [1.1.0](https://github.com/trystan2k/padelbuddy/compare/v1.0.0...v1.1.0) (2026-02-26)

### Features

* create UI components utility with reusable widget factories ([0d00537](https://github.com/trystan2k/padelbuddy/commit/0d00537191611a9424a1e69cc219c7919f81644d))

## 1.0.0 (2026-02-25)

### Features

* add clear app data button with double-tap confirmation ([ce74725](https://github.com/trystan2k/padelbuddy/commit/ce74725fcd471d1b087856433f75ac4296139c8e))
* add declarative layout engine with resolution system ([f0e1c98](https://github.com/trystan2k/padelbuddy/commit/f0e1c988d66cc8df766a968ce22587792a45c987)), closes [#42](https://github.com/trystan2k/padelbuddy/issues/42) [#42](https://github.com/trystan2k/padelbuddy/issues/42)
* add delete match functionality to match details page ([f74f215](https://github.com/trystan2k/padelbuddy/commit/f74f215678007c44338f6e79b5b9ad8527e9908e))
* add game navigation and lifecycle autosave ([55415ba](https://github.com/trystan2k/padelbuddy/commit/55415ba0a6cf68a492784893c9222018f20e952d))
* add GitHub Actions CI/CD workflow ([29c5509](https://github.com/trystan2k/padelbuddy/commit/29c5509aa593b481d2c9a4fbd1b26748b7cc679b))
* add local storage persistence for match state ([c920308](https://github.com/trystan2k/padelbuddy/commit/c920308100cbe51a24e39aab273881966671d33d))
* add match state model, scoring constants, and history stack ([1e23ecb](https://github.com/trystan2k/padelbuddy/commit/1e23ecbe787072a3a8850fb53242d370797df286))
* add match summary screen and completion flow ([7e63ce5](https://github.com/trystan2k/padelbuddy/commit/7e63ce51acb3a0a17010441e78507cede567ca94))
* add multi-language support for Portuguese and Spanish ([6b9aa33](https://github.com/trystan2k/padelbuddy/commit/6b9aa33f7b30f1a48279c6f4598e98bc44a095ba))
* add padel scoring logic engine with tests ([ff31374](https://github.com/trystan2k/padelbuddy/commit/ff31374dfb84d364cd6e47b3900d8ffcbb4f2862))
* add QA controls task to master task list ([75d55e6](https://github.com/trystan2k/padelbuddy/commit/75d55e629d0b38b6ed5f2bc27b0b7369676a8c47))
* add QA controls with Husky, Biome, and Commitlint ([dd8bf15](https://github.com/trystan2k/padelbuddy/commit/dd8bf1542125b2254b38407d6bc119ff5bc703d8))
* add screen utilities with round screen handling ([fefec67](https://github.com/trystan2k/padelbuddy/commit/fefec6759cd42290054cbeb2ad1aa55072bf7dc9)), closes [#41](https://github.com/trystan2k/padelbuddy/issues/41)
* add sets won indicators to game screen ([45658c0](https://github.com/trystan2k/padelbuddy/commit/45658c04f454e6c6ddd013e498d01743730c4b7d))
* add settings page with scroll list and clear app data flow ([f8380df](https://github.com/trystan2k/padelbuddy/commit/f8380df3e596ff28c36637ec4e134e2d507fe957))
* add UI enhancements for navigation icons and background refinements ([7481f0a](https://github.com/trystan2k/padelbuddy/commit/7481f0a6e904605e880f5921f2530980575e3e2b))
* **agents:** enable plan file generation and integration across agents ([186a4e5](https://github.com/trystan2k/padelbuddy/commit/186a4e518e450264fa9ba5c397e7e45d3bdb410e))
* create centralized design tokens utility ([19d12d6](https://github.com/trystan2k/padelbuddy/commit/19d12d63e83a0e14fb1ffddca624a18b174e5f08))
* create layout presets utility with common page structure schemas ([3990f0e](https://github.com/trystan2k/padelbuddy/commit/3990f0e0c9aa6d0791a738655595f83ca7fa21c2))
* enhance home screen UI with button resizing and settings navigation ([fe14f73](https://github.com/trystan2k/padelbuddy/commit/fe14f73f7b3604deb57ec598ac53235c08b00b99))
* **game:** redesign UI for better readability and touch targets ([8bebbf1](https://github.com/trystan2k/padelbuddy/commit/8bebbf19511db7c91d3e4ca0be0c11c13fbd73b1))
* **history:** use watch local time for match timestamps ([9144253](https://github.com/trystan2k/padelbuddy/commit/9144253d40563f3771b277c5e80c8f1dfe23cdbb))
* implement game screen interaction binding and autosave flow ([6de572e](https://github.com/trystan2k/padelbuddy/commit/6de572ef80ad3c0d9ce9db67d3b72f2e6cc801f0))
* implement game screen layout and responsive controls ([a0f9a0f](https://github.com/trystan2k/padelbuddy/commit/a0f9a0f2fdc1af54fd215065c8c132eb929b1a6a))
* implement home screen resume game flow ([7e26f77](https://github.com/trystan2k/padelbuddy/commit/7e26f7719af060efc359f74ab3d5f4bc04d76d58))
* implement home screen start and resume game flow ([7be4671](https://github.com/trystan2k/padelbuddy/commit/7be4671355772728fd1a48e3995add76a78f6572))
* implement match history storage and viewing ([1fa888d](https://github.com/trystan2k/padelbuddy/commit/1fa888da91f6bbbca247d13f013e47d3f1425a0a)), closes [#29](https://github.com/trystan2k/padelbuddy/issues/29)
* implement match state persistence save/load service ([ab065c9](https://github.com/trystan2k/padelbuddy/commit/ab065c9fd4c501be512622c162b0726faee32f7e))
* implement match state schema and persistence utilities ([4e69fa0](https://github.com/trystan2k/padelbuddy/commit/4e69fa0f20a15a57efbc42c7ebd83b8db55ba092))
* implement new match reset and cleanup flow ([dcdcec3](https://github.com/trystan2k/padelbuddy/commit/dcdcec319f4f25f0527ffe1c59a535e7987e3bbe))
* implement pre-match setup flow and access guard ([4e13992](https://github.com/trystan2k/padelbuddy/commit/4e13992d8735a9a5091e4a576f7397cd9b40b867))
* implement release and changelog generation with GitHub Actions ([8c08113](https://github.com/trystan2k/padelbuddy/commit/8c08113d673c7a33ddf06815343d7fb629c21585)), closes [#39](https://github.com/trystan2k/padelbuddy/issues/39)
* implement set and match completion flow ([4d59bfe](https://github.com/trystan2k/padelbuddy/commit/4d59bfed32fca4d6e85d25be909cb23e9b01547a))
* implement undo point restoration and UI integration ([13af5d7](https://github.com/trystan2k/padelbuddy/commit/13af5d7bba0b51b0104c6754486fc969a54c7d70))
* initialize Zepp OS padel score app project structure ([c43c83b](https://github.com/trystan2k/padelbuddy/commit/c43c83b130e9c5a9763499f1520f8aedaccd322f))
* integrate lifecycle persistence triggers for match state ([17d2380](https://github.com/trystan2k/padelbuddy/commit/17d23805ac5a4e5765c819c846f492fa733b0759))
* keep screen on during game to prevent watchface return ([8dcc9f3](https://github.com/trystan2k/padelbuddy/commit/8dcc9f33cf2a1c0941ec2820ad13947f024ce1e0))
* refine game styling and add scoring debounce ([cb8b093](https://github.com/trystan2k/padelbuddy/commit/cb8b093055031a76f002331d2a1a5c91bd99a0c2))
* remove invalid plan file ([f498de4](https://github.com/trystan2k/padelbuddy/commit/f498de44addcb8238aedf754a128bfe1c6c6fdce))
* **settings:** add app version display to settings page ([8b6b58c](https://github.com/trystan2k/padelbuddy/commit/8b6b58c787e70f93ba9b67f378055ebcbb43aa8c))
* **settings:** improve data clearing with toast feedback and reliable file overwrites ([dc9a9b9](https://github.com/trystan2k/padelbuddy/commit/dc9a9b9f8392aa00262705b71c356c34b2fd8905))

### Bug Fixes

* **assets:** update icon assets and references for consistency ([b0532f8](https://github.com/trystan2k/padelbuddy/commit/b0532f8a6cd235a793068bbfc54a01e77bdac393))
* change task id fields from string to integer for consistency ([441408d](https://github.com/trystan2k/padelbuddy/commit/441408d67484eb01a30bce192975a9a56d092d40))
* edge case handling and data validation ([75f0810](https://github.com/trystan2k/padelbuddy/commit/75f0810a1657d13beb27f698538fafa5d9a0e443))
* position settings icon consistently at bottom ([78897a5](https://github.com/trystan2k/padelbuddy/commit/78897a54cb7047b2c33df18a3c2b84338b6f417d))
* resolve storage adapter stale cache causing flaky guard test in CI ([ba09d9c](https://github.com/trystan2k/padelbuddy/commit/ba09d9c426bf23aec5ef3e6d43b2f0a43c460fde))
* **ZeppOsStorageAdapter:** initialize storage to null to prevent runtime errors ([698e869](https://github.com/trystan2k/padelbuddy/commit/698e869e3eb7f633f64e2b9f59fd1af7a84b27cc))

### Code Refactoring

* **agents:** simplify taskmaster integration and reorder preparation steps ([818e362](https://github.com/trystan2k/padelbuddy/commit/818e36215e35b198a5119aac1e85e71ba0dfdd7d))
* remove debug console logs from production code ([a5e7be6](https://github.com/trystan2k/padelbuddy/commit/a5e7be6bb646e0533bf77338b8796be5a38553e1))
* remove hard reset confirmation for starting new game ([b18e8e8](https://github.com/trystan2k/padelbuddy/commit/b18e8e80cab73c4c946f9d0f9c521f6e3e90c310))
* remove invalid onShow lifecycle methods for Zepp OS v1.0 compatibility ([32fac7e](https://github.com/trystan2k/padelbuddy/commit/32fac7edcc355e2dec1a37248a1499c2bc254b33))
* **storage:** replace async storage with synchronous hmFS API ([3fc3aba](https://github.com/trystan2k/padelbuddy/commit/3fc3aba915db3278b608a881c0ee49d235a532e5))
* **summary:** replace static history list with scrollable view and remove new game button ([97488a0](https://github.com/trystan2k/padelbuddy/commit/97488a04785cb72cee5a26e3a0186d8aa0ad8107))

### Added

* Initial release of Padel Buddy
* Padel match score tracking for Amazfit watches
* Support for GTR-3 and GTS-3 devices
* Match history storage and viewing
* Multi-language support (English, Portuguese, Spanish)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
