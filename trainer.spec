# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec для «Тренажер 1С:Профессионал (Платформа 8.3)»

import os

# ---- Путь к корню проекта ----
base = r'c:\Users\oneC\Desktop\Sigma_Learning_programm'

a = Analysis(
    [os.path.join(base, 'server_exe.py')],
    pathex=[base],
    binaries=[],
    datas=[
        # Бандлим только веб-страницы (index.html, app.js, styles.css)
        (os.path.join(base, 'static_web'), 'static_web'),
    ],
    hiddenimports=[
        'http.server',
        'socketserver',
        'webbrowser',
        'threading',
        'posixpath',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        # Исключаем крупные ненужные пакеты (email нужен для http.server — не исключаем!)
        'tkinter', 'unittest', 'doctest',
        'pdb', 'xml', 'xmlrpc',
        'lib2to3', 'setuptools', 'pkg_resources',
        'distutils', 'multiprocessing',
        'pickle', 'shelve', 'test',
    ],
    noarchive=False,
    optimize=2,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Тренажер_1С_Профессионал',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,          # UPX часто ломает exe под Windows Defender
    console=True,       # Консольное окно — пользователь видит статус/ошибки
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon=None,        # Можно добавить .ico файл сюда
)
