# NutriGuard - AI-Enhanced Nutritional Label Scanner and Diabetic Health Assessment

## Project Overview
NutriGuard is a mobile application designed to assist individuals with diabetes in managing their dietary choices effectively. The app combines advanced AI technologies to provide personalized nutritional recommendations:

- **YOLO Label Detection** (mAP50: 0.9, mAP50-95: 0.78)
- **Glycemic Index Predictor** (MSE: 40.46, R² score: 0.94)
- **Diabetica Model** for personalized recommendations
- **Gemini AI** for nutritional label data extraction

## Contributors
- [Aarogya Bhandari](https://github.com/amewzzz)
- [Aayush Pokharel](https://github.com/aayushpkrl)
- [Piyush Luitel](https://github.com/PiyushLuitel-07)
- [Prashant Bhusal](https://github.com/prashant72-git)

## Application Screenshots

| Login/Register | Dashboard | Meal Logging |
|:---:|:---:|:---:|
| ![Login Page](demo/1.%20loginregister_page.png) | ![Dashboard](demo/6.%20dashboard.png) | ![Meal Logging](demo/4.%20meal_logging.png) |

| Profile | Nutritional Info | Recommendations |
|:---:|:---:|:---:|
| ![User Profile](demo/7.%20user_profile.png) | ![Nutritional Info](demo/8.%20nutritional_info_edit_page.png) | ![Recommendations](demo/10.%20recommendation_page.png) |

## Demo Video
Watch our application demo: [NutriGuard Demo Video](https://youtu.be/lKITzzyZT6U)

## Key Features
- Real-time nutritional label scanning and analysis
- Personalized glycemic load calculation
- User-specific health profile management
- AI-powered dietary recommendations
- Blood sugar level tracking
- Meal history logging

## Prerequisites
- Node.js (v16 or higher)
- Expo CLI (`npm install -g expo-cli`)
- Git LFS (for downloading model files)
- Python 3.8+
- Android Studio (for Android development)
- Xcode (for iOS development, Mac only)

## Project Setup

1. Install Git LFS:
```bash
git lfs install
```

2. Clone the repository with models:
```bash
# Clone repository
git clone https://github.com/amewzzz/NutriGuard.git
cd NutriGuard

# Pull LFS files (models)
git lfs pull

# Verify models in app/assets/models/
dir app\assets\models
# Should show:
# - xgboost.joblib
# - random_forest_model.joblib
# - yolo_model.pt
# - scaler.joblib
```

3. Install dependencies:
```bash
# Navigate to app directory
cd app

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

4. Create `.env` file:
```bash
cp .env.example .env
```

## Required API Setup

### 1. Supabase Configuration
1. Create account at [Supabase](https://supabase.com/)
2. Create new project
3. Get credentials from Project Settings > API:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_KEY`: `anon public` key

#### Required Database Tables

```sql
-- Users table
create table public.users (
    id uuid references auth.users primary key,
    full_name text,
    blood_sugar_level double precision,
    medication_details text
);

-- Meals table
create table public.meals (
    meal_id integer primary key,
    user_id uuid references public.users,
    meal_type varchar,
    meal_date date,
    meal_time time
);

-- Meal Items table
create table public.meal_items (
    meal_item_id integer primary key,
    meal_id integer references public.meals,
    food_item varchar,
    quantity varchar,
    unit varchar
);

-- Recommendations table
create table public.recommendations (
    id integer primary key,
    user_id uuid references public.users,
    recommendation_text text
);
```

Note: Authentication is handled by Supabase - no additional auth setup required.

#### Security Policies
```sql
-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.recommendations enable row level security;

-- Create policies
create policy "Users can read own data"
  on users for select
  using (auth.uid() = id);

create policy "Users can manage own meals"
  on meals for all
  using (auth.uid() = user_id);

create policy "Users can manage own meal items"
  on meal_items for all
  using (meal_id in (
    select meal_id from meals where user_id = auth.uid()
  ));

create policy "Users can manage own recommendations"
  on recommendations for all
  using (auth.uid() = user_id);
```

### 2. Gemini API Setup
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Add to `.env` as `GEMINI_API_KEY`

### 3. Nutritionix API Setup
1. Register at [Nutritionix Developer](https://developer.nutritionix.com/)
2. Get credentials:
   - `NUTRITIONIX_APP_ID`: Application ID
   - `NUTRITIONIX_API_KEY`: API Key

### 4. Ngrok Setup (Development Only)
1. Create account at [Ngrok](https://ngrok.com/)
2. Get authtoken
3. Add as `NGROK_AUTHTOKEN` in `.env`

## Environment Configuration

Your `.env` file should contain:
```plaintext
NGROK_URL='your-ngrok-url'
GEMINI_API_KEY='your-key'
SUPABASE_URL='your-url'
SUPABASE_KEY='your-key'
NUTRITIONIX_APP_ID='your-id'
NUTRITIONIX_API_KEY='your-key'
NGROK_AUTHTOKEN='your-token'
```

## Running the Application

### 1. Start Ngrok for Flask Server
```bash
# Open first command prompt and run
ngrok http 5000

# Copy the generated URL and update in app/config/api.js
const NGROK_URL = process.env.NGROK_URL || 'your-ngrok-url';
```

### 2. Run Diabetica Model
1. Open [`notebooks/diabetica_inference.ipynb`](notebooks/diabetica_inference.ipynb) in Kaggle/Google Colab
2. Run all cells in the notebook
3. Copy the generated Ngrok URL
4. Update in [`app/app.py`](app/app.py):
```python
recommendation_response = requests.post(
    "your-diabetica-ngrok-url/generate",
    json={"prompt": prompt, "max_length": 100}
)
```

### 3. Start Flask Backend
```bash
# Open second command prompt
cd app
python app.py
```

### 4. Start Expo Server
```bash
# Open third command prompt
cd app
npx expo start
```

### 5. Run on Mobile Device
1. Install Expo Go app on your phone
2. Scan the QR code shown in terminal
3. App will load on your device

### Directory Structure
```
nutriguard/
├── app/                 # React Native mobile app
└── notebooks/          # Machine learning notebooks
    └── diabetica_inference.ipynb  # Diabetica model inference
```

Note: Keep all command prompts running while using the app.

## Troubleshooting

### Common Issues

1. Metro bundler issues:
```bash
npm start -- --reset-cache
```

2. Android build fails:
```bash
cd android
./gradlew clean
```

3. Environment variables not loading:
   - Restart development server
   - Check `.env` file exists in root directory


