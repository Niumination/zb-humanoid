# Design Spec — zb-humanoid v2 "Figure of Light"

Status: APPROVED (Goldfish findings resolved — GLB via jsDelivr CDN, CC0 verified, build-before-deploy process)
Tanggal: 2026-11-01
Referensi: https://apex-eng.ai/apex/humanoid ("a figure made of light that assembles and reacts as you talk"), docs/PRD.md

## 1. Masalah
Implementasi saat ini secara teknis jalan (300k partikel, Ready, animasi), tapi visualnya "sangat jauh dari yang diharapkan":
- Bentuk wajah prosedural = elipsoid kasar dengan tonjolan hidung; TIDAK mirip kepala/wajah manusia.
- Partikel terlihat flat: tanpa bloom nyata, tanpa variasi kecerahan, tanpa depth-of-field.
- Tidak ada assembly animation yang terlihat saat load (partikel langsung muncul di posisi final).
- Warna ungu monoton.

## 2. Root cause (dari audit kode)
1. head.glb 8.5MB ADA di repo tapi di-skip dari deployment (Vercel file limit via Composio path) → fallback selalu prosedural kasar.
2. Tidak ada pipeline kualitas render: EffectComposer dibuat tapi bloom-nya minimal; tone mapping default.
3. Assembly animation (createAssemblyAnimation) ada di codebase tapi TIDAK dipakai di loadHeadModel (yang dipakai createPolishedAssembly).
4. Distribusi partikel prosedural merata di permukaan elipsoid — wajah manusia butuh densitas bervariasi (area mata/bibir/hidung lebih rapat).

## 3. Desain v2
### 3.1 Geometri kepala (prioritas tertinggi)
- Ganti prosedural kasar dengan sampling dari head.glb yang sudah ada (8.5MB, CC-lisentiable — verifikasi lisensi).
- Deployment: host head.glb di luar bundle Vercel — gunakan GitHub raw / jsDelivr CDN (github.com/Niumination/zb-humanoid) sebagai URL model, dengan fallback prosedural yang diperbaiki.
- Prosedural fallback v2: ellipsoid + noise-based displacement + densitas variabel (Fibonacci sphere mapping) agar siluet lebih organik.

### 3.2 Render quality
- UnrealBloomPass dengan strength ~1.2, radius 0.6, threshold 0.15 (partikel jadi "figure of light").
- AdditiveBlending pada material partikel + alpha 0.85.
- Ukuran partikel variatif (0.8–2.2) dengan random; bright core di area tulang pipi/dahi (sample weight).
- ACESFilmicToneMapping + exposure 1.1.

### 3.3 Assembly animation
- Saat load: partikel mulai menyebar di bola radius 6–8, lerp ke target posisi kepala selama 2.5s dengan easing cubic-out, trigger bloom flash di akhir.
- Implementasi: pakai createAssemblyAnimation yang sudah ada; sambungkan di loadHeadModel sebelum 'Ready'.

### 3.4 Mood states
- idle: breathing pelan, warna #8B5CF6.
- thinking: partikel berpusat pelan (swirl), warna shift biru.
- speaking: pulsa mengikuti audio amplitude, warna cyan.
- alert: jitter cepat + warna merah-oranye.
- (Sudah ada MOODS config; tinggal pastikan morphing benar-benar memengaruhi posisi, bukan hanya warna.)

## 4. Non-goals
- Face tracking/camera (v3).
- Integrasi suara dua-arah.

## 5. Acceptance criteria
- [ ] Siluet kepala manusia terlihat jelas dalam < 3 detik dari load.
- [ ] Assembly animation: partikel terkumpul dari acak → wajah dalam ~2.5s.
- [ ] Bloom membuat partikel bercahaya (screenshot: pixel scan menunjukkan area terang > threshold).
- [ ] FPS ≥ 30 di desktop.
- [ ] Deployment Vercel tetap < 25MB total, tanpa file > 6MB di dalam bundle.

## 6. Risiko
- head.glb lisensi belum diverifikasi → cek asal file sebelum publik.
- Vercel/Composio deploy path bermasalah dengan file besar → solusi CDN eksternal.
- Bloom mahal di GPU lemah → deteksi performa sudah ada (performance.js), turunkan bloom di mode low.
