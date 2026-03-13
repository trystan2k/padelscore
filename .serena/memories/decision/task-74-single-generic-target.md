What: User chose to refactor Task 74 from separate `gtr-3`/`gts-3` v3 targets to a single generic target with shared assets where possible.
Why: The user compared the manifest to a Zepp v3 hello-world example and preferred a cleaner v3-native structure with one target containing all supported platform qualifiers.
Where: app.json target structure and assets namespace/layout for Task 74.
Learned: A single generic v3 target is preferred for mainline migration when page registrations and most assets are shared across supported screen families.