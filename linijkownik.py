file_path = "plik_100k_linii.txt"

with open(file_path, "w", encoding="utf-8") as f:
    for i in range(1, 100001):
        f.write(f"To jest linia numer {i}\n")