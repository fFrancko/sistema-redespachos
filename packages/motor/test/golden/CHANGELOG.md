# Casos dorados del motor — CHANGELOG

Registro de altas y actualizaciones de `casos/`. Lo escriben solo los scripts:

- `scripts/golden-generar.js`: alta de casos nuevos.
- `pnpm --filter @sistema-redespachos/motor golden:update -- --caso <id> --motivo "<texto>"`: actualización de un caso.

Cada línea es `fecha · id · sha256 · motivo`. El sha256 es el del JSON canónico del caso (claves ordenadas, sin formato). `golden.test.ts` exige que cada caso tenga línea, que cada línea tenga caso y que el hash actual sea el de la última línea del caso. No se edita a mano.

## Registro

- 2026-10-07 · `referencia-1` · `0a3928ad2d91630172c3dff333515aa1dc0596f4430e0b69db6f603409b18fa4` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `referencia-2` · `053c9d798ca2763e71ce99b7ccc61c3927cbeda52b3a1b2fdfd285e6fb0111c6` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `tramo-limite-superior-inclusivo` · `690645e815933b47c94652208c8fe2d9efce7256860d4b659abe33a76d4ffcca` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `tramo-apenas-sobre-limite` · `783084dfaf67ac55fe86adb01f989486b340cbb131eb44a0c125c339f808f7ed` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `excedente-volumen` · `8f9cde96d48a0deb2e84350b53cc417c1276418b19c307f3630a012427286446` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `peso-excedido-sin-regla` · `663a5f7227c7a995391f86ce10f03e1f37245d88ea409606f22e29d3dcf4cda3` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `volumen-excedido-sin-regla` · `12710a96e8ffd3bbda00db6de16e9ffc0dd3963896b35504a7bfa667fba349ea` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `solo-reglas-volumen` · `de5a986116f899860ca46a7e6bba1d813db4666e0ecc594b1ede75a309c4c8f7` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `solo-reglas-peso` · `c71e105a8a1330bb482cc1cdfdb1f6aae7f6fe7b8fda664abdcddfb96e6d1fc5` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `empate-criterio-gana-peso` · `402ccca499e3e1abefb7e1cc514ff6a0445ae4201ca8a6b010bc54ffc578c092` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `empate-r7-gana-volumen-con-reglas` · `b6e8229ce1d5d1fd5fc055f75d09ab82a4306ef665120f59e3a2acb10fc5ed19` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `colecta-solo-del-criterio-ganador` · `d855e321a5b3e50fca1c9d0701cf6e66e209668e5eb13e3681c19159f44883f6` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `costo-base-viaje` · `608c48e99d211d9ed56e51f2fe0981926a066e47a3ef4189f9fab3732c09b496` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `redondeo-componente-half-up` · `94d34595f26cea7e050b54ccb1bd2a6698cc917c21dd0d7a81446ba60d916ab8` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `redondeo-iva-half-up` · `6064e08d6d26fa84eb744b4fa2d43bb6d94c7393cb78b0a59909d2a982435ad7` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `redondeo-iva-half-up-centavo-cero` · `fe8108e985e91bb8c799ed95bf208067842984c1a693d00ee618b350591d8268` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `redondeo-seguro-half-up` · `57c3543d2db9eea712a5be5cacdc2e5350b372fef5dd4f2aa73c8f22835fd709` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `seguro-sin-valor-declarado` · `6bed55157d1f509f62a159392d21e66c93ab2ba896d09223eac3a8d1d1c79f55` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `proveedor-sin-seguro-con-valor-declarado` · `23a5847db7df3b6dae48f1adfda93824b45ff358a9b47e582333d5301c37514c` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `ranking-por-total-con-iva` · `4e743f32fcd42fd341fd30d5f22084e9236e507448f83de78382412cccedf5f5` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `empate-total-entre-proveedores` · `55bc9880d6543c043c411d73cbd40ba2ac6ee2966730b7da1ec9db2a99b24d8f` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `empate-total-variantes-sin-ambiguedad` · `35467d9b0ad38a492d9022f19bc7afa8cbf4ada503e8ec6a411efec60eb590d7` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cp-ambiguo-por-total` · `a7a01b472ea649e6da0d47417d7c4a9b64492b8a984b32e1093530c29fbace12` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cp-ambiguo-por-plazo` · `49aef701555cc67787cc664098faf9e0557041a288b3ab20efff5a0e213cdbb4` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `variantes-de-proveedores-distintos-sin-ambiguedad` · `dcb40ef491dba52f49aee7c0d547fa3032c27904a0de75e0c20512870b00d923` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `filtro-provincia-destino` · `f9b285438827ab67bef7422f4a9d2f35d3789c8380d3cab8e0333989cbac825d` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `provincia-difiere` · `e5d6a48bd22099f9d91d4ca7ad40fab279447aebde87645bba05dd66c64586b0` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `origen-estricto-provincia-distinta` · `47c784ad25f3cab460f2c274972440887f0e87ce96edc5754e54cf0ae8068cc6` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `origen-no-estricto-unica-provincia` · `530b204b9c6775bcf7c2e069a7aeb24bf4d4c46e1a96fc65c7f8e9291474afc8` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `origen-no-estricto-dos-provincias` · `5ecdb2c6be6e582e4f1617bcad3923041601f8ad73d2d20139b016ec6ec36668` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `precedencia-origen-localidad` · `f71b423a933c56dc21ca471e112d1ea5619e268e4cc0bc9c714a64e0e1d8ed06` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `precedencia-origen-provincia` · `cb59ac5766a2bceed19ecbde3da10785c445691b70122f90da3e3ac1b21a50e7` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `sin-caida-a-grupo-general` · `d37a2f0f27a11a7bd99556ac2fbb0ec7eb06ea9911158e7b41c48fe7f957804d` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cobertura-qx-con-expresos` · `1096cb1c0a53bb61b80b0c81830ed342c4b536a2acffc04b8976c2ecd4435868` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cobertura-qx-sin-expresos` · `051203caf4d9d76f7bc0d96a03c1110018e46f8b575ec2a16f0007db403bee08` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cp-destino-fuera-del-canalizador` · `81f4072a76ea74d992597fba70783abc05c8be6be3fdbe1a393e5730029a7142` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cp-origen-fuera-del-canalizador` · `c759a549b789a26bb0c0ec41afb9255fba5eeb78ebf99e1f48d98a1d51dd0b86` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `vigencia-tarifario-vigente` · `344da5361e96647f12b97e2eb555bd5512ed45f370e8517fb5e2e825adf74f16` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `vigencia-tarifario-historico` · `03a6910ba3f3543f06d5d751368a4adc761f73e4a673e7513a0703b9be487865` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `tarifario-borrador-no-aplica` · `642b5093f3d6bc93562db17f16630cc8d015f05c963cc36e42b472385f57a19b` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `proveedor-inactivo` · `b9061fcd535a47db4beae1dce3f2b90423e5de5c4a27ca9da5284aea3b3e294d` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `cp-sin-reglas` · `dc6e02c865fe8f971103abbfb5956dcf7f9d4cb141c23179c7ea0de8d3133f0d` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `tramos-solapados` · `d37156dfcf63ca1b97ef53854683a9ed7f17263f75059d9a0c82b3fcbce5811c` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `descartes-y-validas-mezcladas` · `a861192b0a805b0ba62246401121df09b89e12521d475cdb78438b21e947342c` · alta: set inicial sintético (MVP-15)
- 2026-10-07 · `tope-20-alternativas` · `cf49c0afc99333828e6714afb52b7c5dcc08d9fe74adcf11fb2db08475e1f298` · alta: set inicial sintético (MVP-15)
