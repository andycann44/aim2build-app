import os, sysconfig, importlib.util

def _load_stdlib_csv():
    stdlib = sysconfig.get_paths()['stdlib']
    path = os.path.join(stdlib, 'csv.py')
    spec = importlib.util.spec_from_file_location('csv_std', path)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[attr-defined]
    assert spec and spec.loader, "Could not locate stdlib csv.py"
    spec.loader.exec_module(mod)                 # type: ignore[assignment]
    return mod

csv_module = _load_stdlib_csv()
