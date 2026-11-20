import json, os

locales = ['en', 'es', 'fr', 'ru', 'zh', 'ar', 'vi']
key = 'USER_EMAIL_EXISTS'
value = {
    'en': 'An account with that email already exists. Please log in to continue.',
    'es': 'Una cuenta con ese correo ya existe. Inicie sesión para continuar.',
    'fr': 'Un compte avec cet email existe déjà. Veuillez vous connecter.',
    'ru': 'Учетная запись с таким email уже существует. Пожалуйста, войдите.',
    'zh': '该邮箱已被注册。请登录继续。',
    'ar': '账户已存在。请登录继续。',
    'vi': 'Tài khoản có email này đã tồn tại. Vui lòng đăng nhập để tiếp tục.'
}

for loc in locales:
    path = f'src/assets/i18n/{loc}.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if 'USER' not in data:
        data['USER'] = {}
    data['USER'][key] = value[loc]
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f'Updated {loc}')