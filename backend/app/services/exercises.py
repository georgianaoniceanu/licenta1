EXERCISES = [
    # /θ/ phoneme
    {"id": "1", "phoneme": "/θ/", "word": "think", "sentence": "I think this is the right answer.", "difficulty": "B1"},
    {"id": "2", "phoneme": "/θ/", "word": "three", "sentence": "There are three things I need to tell you.", "difficulty": "B1"},
    {"id": "3", "phoneme": "/θ/", "word": "thunder", "sentence": "The thunder was loud throughout the night.", "difficulty": "B2"},
    {"id": "4", "phoneme": "/θ/", "word": "therefore", "sentence": "I studied hard, therefore I passed the exam.", "difficulty": "B2"},
    {"id": "5", "phoneme": "/θ/", "word": "enthusiasm", "sentence": "She showed great enthusiasm for the project.", "difficulty": "C1"},

    # /w/ phoneme
    {"id": "6", "phoneme": "/w/", "word": "water", "sentence": "Would you like some water with your meal?", "difficulty": "B1"},
    {"id": "7", "phoneme": "/w/", "word": "world", "sentence": "The world is changing faster than ever.", "difficulty": "B1"},
    {"id": "8", "phoneme": "/w/", "word": "worth", "sentence": "This experience is worth every effort.", "difficulty": "B2"},
    {"id": "9", "phoneme": "/w/", "word": "overwhelmed", "sentence": "I felt overwhelmed by the workload.", "difficulty": "B2"},
    {"id": "10", "phoneme": "/w/", "word": "worthwhile", "sentence": "Learning a language is always worthwhile.", "difficulty": "C1"},

    # /æ/ phoneme
    {"id": "11", "phoneme": "/æ/", "word": "cat", "sentence": "The black cat sat on the mat.", "difficulty": "B1"},
    {"id": "12", "phoneme": "/æ/", "word": "bad", "sentence": "That was a bad decision in the end.", "difficulty": "B1"},
    {"id": "13", "phoneme": "/æ/", "word": "ambitious", "sentence": "She is ambitious and works very hard.", "difficulty": "B2"},
    {"id": "14", "phoneme": "/æ/", "word": "practical", "sentence": "We need a practical solution to this problem.", "difficulty": "B2"},
    {"id": "15", "phoneme": "/æ/", "word": "satisfaction", "sentence": "I felt great satisfaction after finishing the task.", "difficulty": "C1"},

    # /ð/ phoneme
    {"id": "16", "phoneme": "/ð/", "word": "the", "sentence": "The more you practice, the better you get.", "difficulty": "B1"},
    {"id": "17", "phoneme": "/ð/", "word": "this", "sentence": "This is exactly what I was looking for.", "difficulty": "B1"},
    {"id": "18", "phoneme": "/ð/", "word": "breathe", "sentence": "Remember to breathe deeply before speaking.", "difficulty": "B2"},
    {"id": "19", "phoneme": "/ð/", "word": "although", "sentence": "Although it was difficult, she succeeded.", "difficulty": "B2"},
    {"id": "20", "phoneme": "/ð/", "word": "nevertheless", "sentence": "Nevertheless, we continued with the presentation.", "difficulty": "C1"},
]

def get_all_exercises():
    return EXERCISES

def get_exercise_by_id(exercise_id: str):
    return next((e for e in EXERCISES if e["id"] == exercise_id), None)

def get_exercises_by_phoneme(phoneme: str):
    return [e for e in EXERCISES if e["phoneme"] == phoneme]

def get_exercises_by_difficulty(difficulty: str):
    return [e for e in EXERCISES if e["difficulty"] == difficulty]