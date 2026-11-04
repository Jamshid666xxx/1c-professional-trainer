# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec для «Тренажер 1С:Профессионал (Платформа 8.3)»
#
# Главное изменение (фикс пустых вопросов): бандлим dataset.json и веб-файлы
# ВНУТРЬ exe (в _MEIPASS). server_exe.py теперь ищет dataset.json сначала в
# бандле, затем рядом с exe — поэтому EXE из dist/ снова отдаёт вопросы
# без внешних файлов. Предыдущий spec бандлил несуществующую папку
# static_web и НЕ бандлил dataset.json -> /dataset.json 404 -> пустые вопросы.

import os

# Корень проекта = папка, где лежит этот .spec. PyInstaller 6 может выполнять
# spec в namespace без __file__, поэтому делаем надёжный fallback на cwd
# (PyInstaller запускает сборку из каталога проекта). Это замена хардкод-
# пути c:\Users\oneC\... из старого spec.
try:
    base = os.path.dirname(os.path.abspath(__file__))
except NameError:
    base = os.getcwd()

a = Analysis(
    [os.path.join(base, 'server_exe.py')],
    pathex=[base],
    binaries=[],
    datas=[
        # Бандлим веб-файлы И данные в КОРЕНЬ бандла (_MEIPASS).
        # server_exe.py.resource_path('.') в frozen-режиме = _MEIPASS,
        # поэтому resolve_path() найдёт их внутри exe.
        (os.path.join(base, 'index.html'), '.'),
        (os.path.join(base, 'styles.css'), '.'),
        (os.path.join(base, 'app.js'), '.'),
        (os.path.join(base, 'dataset.json'), '.'),
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
