import json
import os
import glob
import re
from PIL import Image

base_dir = r"c:\Users\oneC\Desktop\Sigma_Learning_programm\Новая папка"
output_dir = r"c:\Users\oneC\Desktop\Sigma_Learning_programm\images"
os.makedirs(output_dir, exist_ok=True)

with open(r'c:\Users\oneC\Desktop\Sigma_Learning_programm\questions_raw.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

disk_files = glob.glob(os.path.join(base_dir, "*", "*.jpg"))
file_map = {os.path.basename(p): p for p in disk_files}

def detect_options_order(img_path, num_options):
    try:
        im = Image.open(img_path)
    except Exception:
        return None
    w, h = im.size
    
    y_min = int(0.12 * h)
    y_max = int(0.85 * h)
    
    rows = []
    step = 4
    for y in range(y_min, y_max, step):
        yellow, green, total = 0, 0, 0
        for x in range(int(0.15 * w), int(0.85 * w), 15):
            r, g, b = im.getpixel((x, y))[:3]
            total += 1
            if r > 180 and g > 160 and b < 80:
                yellow += 1
            elif g > 70 and g > r + 20 and g > b + 20:
                green += 1
        rows.append((y, yellow / total, green / total))
        
    in_btn = False
    btn_type = None
    btn_start = None
    buttons = []
    for y, py, pg in rows:
        is_btn = (py > 0.35 or pg > 0.35)
        btype = 'green' if pg > py else 'yellow'
        if is_btn:
            if not in_btn:
                in_btn = True
                btn_start = y
                btn_type = btype
            else:
                if btype == 'green':
                    btn_type = 'green'
        else:
            if in_btn:
                in_btn = False
                if y - btn_start >= 30:
                    buttons.append((btn_start, y, btn_type))
    if in_btn and (y_max - btn_start >= 30):
        buttons.append((btn_start, y_max, btn_type))
        
    if len(buttons) >= num_options:
        candidate_buttons = buttons[-num_options:]
        colors = [b[2] for b in candidate_buttons]
        if colors.count('green') == 1:
            return colors.index('green')
            
    greens = [i for i, b in enumerate(buttons) if b[2] == 'green']
    if greens and buttons[greens[0]][1] - buttons[greens[0]][0] < 70 and buttons[greens[0]][0] < 0.45 * h:
        greens = greens[1:]
        
    if len(greens) == 1:
        g_idx = greens[0]
        from_end = len(buttons) - 1 - g_idx
        if from_end < num_options:
            return num_options - 1 - from_end
            
    return None

def crop_diagram_if_present(img_path, fname, q_text):
    try:
        im = Image.open(img_path)
    except Exception:
        return None
    w, h = im.size
    
    q_lower = q_text.lower()
    img_keywords = ['рисун', 'картинк', 'диаграмм', 'схем', 'показан', 'приведен', 'отображен', 'окне', 'картинке']
    has_mention = any(kw in q_lower for kw in img_keywords)
    
    banner_y = None
    for y in range(220, int(0.65 * h), 3):
        r, g, b = im.getpixel((w // 2, y))[:3]
        if g > 130 and g > r + 30 and g > b + 30:
            banner_y = y
            break
            
    if banner_y and banner_y > 450 and has_mention:
        box = (20, 230, w - 20, banner_y - 15)
        crop_name = os.path.splitext(fname)[0] + ".png"
        crop_path = os.path.join(output_dir, crop_name)
        im.crop(box).save(crop_path)
        return "images/" + crop_name
    elif banner_y and banner_y > 620:
        box = (20, 230, w - 20, banner_y - 15)
        crop_name = os.path.splitext(fname)[0] + ".png"
        crop_path = os.path.join(output_dir, crop_name)
        im.crop(box).save(crop_path)
        return "images/" + crop_name
        
    return None

def fallback_position(correct_ans, incorrect_list):
    c_lower = correct_ans.strip().lower()
    if 'все указанные' in c_lower or 'все варианты' in c_lower or 'все вышеперечисленные' in c_lower or 'нет правильного' in c_lower:
        return len(incorrect_list)
        
    m = re.search(r'вариант[ыа]?\s*(\d+)(?:\s*(?:и|или|,)\s*(\d+))?', c_lower)
    if m:
        nums = [int(x) for x in m.groups() if x]
        if nums:
            max_ref = max(nums)
            return min(len(incorrect_list), max_ref)
            
    return len(incorrect_list)

dataset = []
q_counter = 0

for sec_name, qmap in raw_data.items():
    clean_sec = sec_name.strip()
    
    for fname, qinfo in qmap.items():
        q_counter += 1
        question_text = qinfo.get('question', '').strip()
        correct_ans = qinfo.get('correct_answer', '').strip()
        incorrect_list = [x.strip() for x in qinfo.get('incorrect_answers', [])]
        
        num_options = len(incorrect_list) + 1
        path = file_map.get(fname)
        
        idx = None
        if path:
            idx = detect_options_order(path, num_options)
            
        if idx is None:
            idx = fallback_position(correct_ans, incorrect_list)
            
        idx = max(0, min(len(incorrect_list), idx))
        
        options = list(incorrect_list)
        options.insert(idx, correct_ans)
        
        diagram_rel_path = None
        if path:
            diagram_rel_path = crop_diagram_if_present(path, fname, question_text)
            
        screenshot_rel_path = None
        if path:
            screenshot_rel_path = os.path.relpath(path, r"c:\Users\oneC\Desktop\Sigma_Learning_programm").replace('\\', '/')
            
        dataset.append({
            "id": f"q_{q_counter}",
            "filename": fname,
            "section": clean_sec,
            "question": question_text,
            "options": options,
            "correct_index": idx,
            "correct_answer": correct_ans,
            "diagram": diagram_rel_path,
            "screenshot": screenshot_rel_path
        })

out_json = r"c:\Users\oneC\Desktop\Sigma_Learning_programm\dataset.json"
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

diag_count = sum(1 for q in dataset if q['diagram'])
print(f"Total questions: {len(dataset)}")
print(f"Diagrams cropped: {diag_count}")
