<!-- {"documentId":"bme280-power","title":"Nguồn cấp BME280","version":"1.0","hardwareVariant":"all","firmwareVersion":"any","verifiedAt":"2026-11-02","status":"verified","source":"https://www.bosch-sensortec.com/en/products/environmental-sensors/humidity-sensors-bme280","keywords":["bme280","nguồn","điện áp","vdd","vddio","3.3v","5v","module"]} -->

## Điện áp của IC và module BME280
IC BME280 có VDD 1,71–3,6 V và VDDIO 1,2–3,6 V theo Bosch; 3,3 V nằm trong cả hai dải. Không cấp trực tiếp 5 V vào VDD/VDDIO của IC. Một module breakout có thể có bộ ổn áp và mạch chuyển mức riêng, nhưng phải kiểm tra đúng model và sơ đồ module trước khi dùng chân VIN ở điện áp khác. Khi ghép ESP32-S3, kiểm tra cả mức kéo lên SDA/SCL và mass chung. Dải nguồn của Hall A3144 không áp dụng cho BME280.
