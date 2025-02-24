from flask import Flask, request, jsonify
import os
import json
import google.generativeai as genai
import joblib
import pandas as pd
from ultralytics import YOLO
import cv2
import numpy as np
import requests
from PIL import Image
import tempfile
from flask_cors import CORS

import logging, base64
import io
import logging
import tempfile
import traceback

# Add this import at the top
import re

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

import os
from dotenv import load_dotenv
from supabase import create_client, Client

from functools import wraps
from datetime import datetime

# Move load_dotenv() to the very top of the file, right after imports
load_dotenv()

# Add this debug code temporarily to check if env variables are loaded
print("Nutritionix APP_ID:", os.getenv('NUTRITIONIX_APP_ID'))
print("Nutritionix API_KEY:", os.getenv('NUTRITIONIX_API_KEY'))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize models and configurations
genai.configure(api_key=os.getenv('GENAI_API_KEY'))


# Get Supabase credentials from .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Load models
yolo_model = YOLO('./assets/models/yolo_model.pt')
rf_model = joblib.load('./assets/models/random_forest_model.joblib')
scaler = joblib.load('./assets/models/scaler.joblib')

# Configure Gemini
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

gemini_model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    generation_config=generation_config,
)

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization token missing or invalid"}), 401

        token = auth_header.split("Bearer ")[-1]

        try:
            user_response = supabase.auth.get_user(token)  # Validate token with Supabase
            user = user_response.user  # Get user details

            if not user:
                return jsonify({"error": "Invalid or expired token"}), 401

            # Attach user info to request for later use (optional)
            request.user = user  

        except Exception as e:
            return jsonify({"error": str(e)}), 500

        return f(*args, **kwargs)

    return decorated_function




def calculate_glycemic_data(nutrition_data):
    # Extract relevant nutritional values
    print(nutrition_data)
    # Define static terms, key mapping, and unit conversions
    static_terms = ["calories", "carbohydrate", "protein", "fat", "sodium", 
                    "potassium", "magnesium", "calcium", "fiber"]

    key_mapping = {
        "Energy": "calories",
        "Protein": "protein",
        "Total Carbohydrate": "carbohydrate",
        "Fat": "fat",
        "Sodium": "sodium",
        "Potassium": "potassium",
        "Magnesium": "magnesium",
        "Calcium": "calcium",
        "Dietary Fiber": "fiber",
    }

    unit_conversions = {
        "kcal": 1,          # Energy units
        "cal": 0.001,
        "joules": 0.000239006,
        "g": 1,             # Mass units
        "mg": 0.001,
        "oz": 28.3495,
        "lb": 453.592,
    }

    # Extract serving size and convert to grams
    serving_size = float(nutrition_data['nutrition_data']['serving_size'].strip('g'))

    # Initialize result dictionary with default values
    result = {term: 0 for term in static_terms}

    # Convert nutrition values
    for json_key, static_key in key_mapping.items():
        if static_key in static_terms:
            nutrient = nutrition_data['nutrition_data']['nutrients'].get(json_key, {})
            value = nutrient.get("per_100g", 0) or 0  # Handle null values
            unit = nutrient.get("unit", "").lower()

            # Convert value to grams or milligrams based on the nutrient
            if unit in unit_conversions:
                value *= unit_conversions[unit]

            # Scale value to the serving size
            value *= (serving_size / 100)

            # Convert specific nutrients to milligrams
            if static_key in ["magnesium", "calcium", "fiber"]:
                value *= 1000  # Convert grams to milligrams

            result[static_key] = round(value, 2)  # Round to 2 decimal places

    # Prepare input data for glycemic index prediction
    input_data = pd.DataFrame({
        'Calories': [result['calories']],
        'Carbohydrates': [result['carbohydrate']],
        'Protein': [result['protein']],
        'Fat': [result['fat']],
        'Sodium Content': [result['sodium']],
        'Potassium Content': [result['potassium']],
        'Magnesium Content': [result['magnesium']],
        'Calcium Content': [result['calcium']],
        'Fiber Content': [result['fiber']]
    })

    # Scale the input data and predict glycemic index
    scaled_input = scaler.transform(input_data)
    predicted_gi = rf_model.predict(scaled_input)[0]

    # Calculate glycemic load
    predicted_gl = (predicted_gi * result['carbohydrate']) / 100
    print(result)
    # Print the results
    print("Predicted Glycemic Index:", predicted_gi)
    print("Predicted Glycemic Load:", predicted_gl)

    # Get recommendation
    sugar_level = request.form.get('sugar_level', 70)  # Default value of 70 if not provided
    prompt = (
        f"The glycemic load of food that a person is going to consume is {predicted_gl}. "
        f"His measured blood sugar level is {sugar_level}. "
        f"Can the person consume the food based on the given glycemic load and his sugar level? "
        f"Don't show the calculation. "
        f"The nutritional value of carbohydrate present in the food is {result['carbohydrate']}. "
        f"The threshold glycemic load for a person for a day is 50. "
        f"You can also recommend foods with less glycemic load. "
        f"Write in 25 words and in second person."
    )

    recommendation_response = requests.post(
        "https://92a8-34-75-161-73.ngrok-free.app/generate",
        json={"prompt": prompt, "max_length": 100}
    )
    Db_response = recommendation_response.json().get('response', 'No recommendation available')
    recommendation = Db_response[435:]
    return {
        'processed_nutrition': result,
        'glycemic_index': float(predicted_gi),
        'glycemic_load': float(predicted_gl),
        'recommendation': recommendation,
    }

# ------------------------ Authentication Routes ------------------------

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Check if user already exists
        try:
            existing_user = supabase.auth.get_user_by_email(email)
            if existing_user:
                return jsonify({"error": "Email already registered"}), 400
        except:
            pass

        # Register user with Supabase
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        if not auth_response.user:
            return jsonify({"error": "Registration failed"}), 400

        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "user_id": auth_response.user.id
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        # Validate required fields
        if not email or not password:
            return jsonify({
                "error": "Email and password are required"
            }), 400

        # Email validation
        import re
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, email):
            return jsonify({
                "error": "Invalid email format"
            }), 400

        try:
            # Sign in user with Supabase
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if not auth_response.user:
                return jsonify({
                    "error": "Invalid credentials"
                }), 401

            # Get user details from database
            user_details = supabase.table('users')\
                .select("*")\
                .eq('id', auth_response.user.id)\
                .execute()

            return jsonify({
                "token": auth_response.session.access_token,
                "user": {
                    "id": auth_response.user.id,
                    "email": auth_response.user.email,
                    "full_name": user_details.data[0].get('full_name') if user_details.data else None
                },
                "is_first_login": len(user_details.data) == 0
            }), 200

        except Exception as auth_error:
            print(f"Authentication error: {str(auth_error)}")
            return jsonify({
                "error": "Invalid credentials"
            }), 401

    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            "error": "An error occurred during login"
        }), 500

@app.route('/protected', methods=['GET'])
@require_auth
def protected_route():
    return jsonify({"message": "You accessed a protected route!", "user": request.user.email}), 200


@app.route('/logout', methods=['POST'])
@require_auth
def logout():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "No authorization token provided"}), 401

        token = auth_header.split("Bearer ")[-1]
        
        # Sign out the user from Supabase
        supabase.auth.sign_out()
        
        return jsonify({
            "success": True,
            "message": "Logged out successfully"
        }), 200

    except Exception as e:
        print("Logout error:", str(e))  # For debugging
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/user/details', methods=['POST'])
@require_auth
def update_user_details():
    try:
        data = request.get_json()
        user_id = request.user.id

        # Validate required fields
        required_fields = ['full_name', 'blood_sugar_level', 'medication_details']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        # Validate blood sugar level
        try:
            blood_sugar_level = float(data['blood_sugar_level'])
            if blood_sugar_level <= 0:
                return jsonify({"error": "Blood sugar level must be a positive number"}), 400
        except ValueError:
            return jsonify({"error": "Blood sugar level must be a valid number"}), 400

        # Prepare user data
        user_data = {
            'id': user_id,
            'full_name': data['full_name'],
            'blood_sugar_level': blood_sugar_level,
            'medication_details': data['medication_details']
        }

        # Update user details in database
        result = supabase.table('users').upsert(user_data).execute()

        if not result.data:
            return jsonify({"error": "Failed to update user details"}), 500

        return jsonify({
            "message": "User details updated successfully",
            "user": result.data[0]
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/user/details', methods=['GET'])
@require_auth
def get_user_details():
    try:
        user_id = request.user.id

        # Get user details from database
        result = supabase.table('users').select("*").eq('id', user_id).execute()

        if not result.data:
            return jsonify({"error": "User details not found"}), 404
            ##################################take to enter user details page#######################################

        user_details = result.data[0]
        
        return jsonify({
            "user": {
                "id": user_details['id'],
                "full_name": user_details['full_name'],
                "blood_sugar_level": user_details['blood_sugar_level'],
                "medication_details": user_details['medication_details']
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route('/user/health-update', methods=['PATCH'])
@require_auth
def update_health_details():
    try:
        data = request.get_json()
        user_id = request.user.id

        # Verify at least one field is provided
        if not data or not any(key in data for key in ['blood_sugar_level', 'medication_details']):
            return jsonify({
                "error": "Provide at least one field to update: blood_sugar_level or medication_details"
            }), 400

        # Get current user data
        current_user = supabase.table('users').select("*").eq('id', user_id).execute()
        
        if not current_user.data:
            return jsonify({"error": "User not found"}), 404

        # Prepare update data with current values
        update_data = {
            'id': user_id,
            'full_name': current_user.data[0]['full_name'],  # Preserve existing name
            'blood_sugar_level': current_user.data[0]['blood_sugar_level'],  # Keep existing value
            'medication_details': current_user.data[0]['medication_details']  # Keep existing value
        }

        # Update blood sugar level if provided
        if 'blood_sugar_level' in data:
            try:
                blood_sugar_level = float(data['blood_sugar_level'])
                if blood_sugar_level <= 0:
                    return jsonify({"error": "Blood sugar level must be a positive number"}), 400
                update_data['blood_sugar_level'] = blood_sugar_level
            except ValueError:
                return jsonify({"error": "Blood sugar level must be a valid number"}), 400

        # Update medication details if provided
        if 'medication_details' in data:
            if not data['medication_details'].strip():
                return jsonify({"error": "Medication details cannot be empty"}), 400
            update_data['medication_details'] = data['medication_details']

        # Update user details in database
        result = supabase.table('users').upsert(update_data).execute()

        if not result.data:
            return jsonify({"error": "Failed to update health details"}), 500

        return jsonify({
            "message": "Health details updated successfully",
            "updated_fields": list(set(data.keys())),
            "user": {
                "id": result.data[0]['id'],
                "full_name": result.data[0]['full_name'],
                "blood_sugar_level": result.data[0]['blood_sugar_level'],
                "medication_details": result.data[0]['medication_details']
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/user', methods=['GET'])
@require_auth
def get_authenticated_user():
    """
    Get details of the currently authenticated user.
    """
    try:
        auth_header = request.headers.get('Authorization')
        token = auth_header.split("Bearer ")[-1]

        user = supabase.auth.get_user(token)
        return jsonify({"user": user}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Add this after your other routes

@app.route('/meals', methods=['POST', 'GET'])
@require_auth
def handle_meals():
    try:
        user = request.user

        if request.method == 'GET':
            # Get all meals for the user with their items
            meals_response = supabase.table('meals')\
                .select('*, meal_items(*)')\
                .eq('user_id', user.id)\
                .execute()
            
            # Format the response
            meals = []
            for meal in meals_response.data:
                meal_items = meal.pop('meal_items', [])
                meal['food_items'] = meal_items
                meals.append(meal)
                
            return jsonify({"meals": meals}), 200

        # POST method
        data = request.json
        meals_data = data.get('meals', [])  # Get array of meals
        
        if not meals_data:
            return jsonify({"error": "No meals provided"}), 400

        all_meals = []
        
        for meal_data in meals_data:
            meal_type = meal_data.get('meal_type')
            food_items = meal_data.get('food_items')
            meal_date = meal_data.get('date', datetime.now().date().isoformat())
            meal_time = meal_data.get('time', datetime.now().time().isoformat())
            
            if not all([meal_type, food_items]):
                return jsonify({"error": f"Meal type and food items are required for {meal_type or 'unknown meal'}"}), 400

            # Create the meal entry
            meal_data = {
                "user_id": user.id,
                "meal_type": meal_type,
                "meal_date": meal_date,
                "meal_time": meal_time
            }

            meal_response = supabase.table('meals').insert(meal_data).execute()
            
            if not meal_response.data:
                continue
                
            meal_id = meal_response.data[0]['meal_id']

            # Create the meal items
            meal_items_data = [{
                "meal_id": meal_id,
                "food_item": item['name'],
                "quantity": item['quantity'],
                "unit": item['unit']
            } for item in food_items]

            meal_items_response = supabase.table('meal_items').insert(meal_items_data).execute()

            all_meals.append({
                **meal_response.data[0],
                "food_items": meal_items_response.data
            })

        return jsonify({
            "message": "Meals logged successfully",
            "meals": all_meals
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/meals/previous', methods=['GET'])
@require_auth
def get_previous_meals():
    try:
        user = request.user
        meal_type = request.args.get('meal_type')

        if not meal_type:
            return jsonify({"error": "Meal type is required"}), 400

        # Get meals with their items
        response = supabase.table('meals')\
            .select('*, meal_items(*)')\
            .eq('user_id', user.id)\
            .eq('meal_type', meal_type)\
            .order('meal_date.desc', 'meal_time.desc')\
            .execute()

        # Format the response
        meals = []
        for meal in response.data:
            meal_items = meal.pop('meal_items', [])
            meal['food_items'] = meal_items
            meals.append(meal)

        return jsonify({
            "previous_meals": meals
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/meals/today', methods=['GET'])
@require_auth
def get_today_meals():
    try:
        user = request.user
        today = datetime.now().date().isoformat()

        # Get today's meals with their items
        response = supabase.table('meals')\
            .select('*, meal_items(*)')\
            .eq('user_id', user.id)\
            .eq('meal_date', today)\
            .execute()

        # Format the response
        meals = []
        for meal in response.data:
            meal_items = meal.pop('meal_items', [])
            meal['food_items'] = meal_items
            meals.append(meal)

        return jsonify({
            "meals": meals,
            "date": today
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/meals/today/nutrition', methods=['GET'])
@require_auth
def get_today_meals_nutrition():
    try:
        # Add debug prints
        print("Environment variables in route:")
        print("APP_ID:", os.getenv('NUTRITIONIX_APP_ID'))
        print("API_KEY:", os.getenv('NUTRITIONIX_API_KEY'))
        
        user = request.user
        today = datetime.now().date().isoformat()

        # Get today's meals with their items
        response = supabase.table('meals')\
            .select('*, meal_items(*)')\
            .eq('user_id', user.id)\
            .eq('meal_date', today)\
            .execute()

        # Nutritionix API configuration
        APP_ID = os.getenv('NUTRITIONIX_APP_ID')
        API_KEY = os.getenv('NUTRITIONIX_API_KEY')

        if not APP_ID or not API_KEY:
            print("Missing credentials - APP_ID:", APP_ID, "API_KEY:", API_KEY)
            return jsonify({
                "error": "Nutritionix API credentials not configured"
            }), 500

        # Format all food items into a single query string
        query_items = []
        for meal in response.data:
            for item in meal.get('meal_items', []):
                query_items.append(f"{item['quantity']} {item['unit']} {item['food_item']}")

        query = ', '.join(query_items)

        url = 'https://trackapi.nutritionix.com/v2/natural/nutrients'

        headers = {
            'x-app-id': APP_ID,
            'x-app-key': API_KEY,
            'Content-Type': 'application/json'
        }

        data = {
            'query': query,
            'timezone': 'Asia/Kathmandu'
        }

        # Make request to Nutritionix API
        nutrition_response = requests.post(url, headers=headers, json=data)

        if nutrition_response.status_code != 200:
            return jsonify({
                "error": "Failed to fetch nutritional information",
                "details": nutrition_response.text
            }), 500

        nutrition_data = nutrition_response.json()

        # Process nutritional information
        filtered_nutrition = {
            "Calories": 0,
            "Carbohydrates": 0,
            "Protein": 0,
            "Fat": 0,
            "Sodium Content": 0,
            "Potassium Content": 0,
            "Magnesium Content": 0,
            "Calcium Content": 0,
            "Fiber Content": 0
        }

        for item in nutrition_data.get("foods", []):
            filtered_nutrition["Calories"] += item.get("nf_calories", 0)
            filtered_nutrition["Carbohydrates"] += item.get("nf_total_carbohydrate", 0)
            filtered_nutrition["Protein"] += item.get("nf_protein", 0)
            filtered_nutrition["Fat"] += item.get("nf_total_fat", 0)
            filtered_nutrition["Sodium Content"] += item.get("nf_sodium", 0)
            filtered_nutrition["Potassium Content"] += item.get("nf_potassium", 0)
            filtered_nutrition["Magnesium Content"] += item.get("nf_magnesium", 0)
            filtered_nutrition["Calcium Content"] += item.get("nf_calcium", 0)
            filtered_nutrition["Fiber Content"] += item.get("nf_dietary_fiber", 0)

        return jsonify({
            "date": today,
            "meals": response.data,
            "nutrition": filtered_nutrition
        }), 200

    except Exception as e:
        print("Error fetching nutrition data:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/meals/today/glycemic', methods=['GET'])
@require_auth
def get_today_glycemic():
    try:
        user = request.user
        today = datetime.now().date().isoformat()

        # Get today's nutritional data first
        response = supabase.table('meals')\
            .select('*, meal_items(*)')\
            .eq('user_id', user.id)\
            .eq('meal_date', today)\
            .execute()

        if not response.data:
            return jsonify({
                "message": "No meals logged today",
                "glycemic_index": 0,
                "glycemic_load": 0
            }), 200

        # Format all food items into a single query string
        query_items = []
        for meal in response.data:
            for item in meal.get('meal_items', []):
                query_items.append(f"{item['quantity']} {item['unit']} {item['food_item']}")

        query = ', '.join(query_items)

        # Nutritionix API configuration
        APP_ID = os.getenv('NUTRITIONIX_APP_ID')
        API_KEY = os.getenv('NUTRITIONIX_API_KEY')

        url = 'https://trackapi.nutritionix.com/v2/natural/nutrients'
        headers = {
            'x-app-id': APP_ID,
            'x-app-key': API_KEY,
            'Content-Type': 'application/json'
        }
        data = {
            'query': query,
            'timezone': 'Asia/Kathmandu'
        }

        # Make request to Nutritionix API
        nutrition_response = requests.post(url, headers=headers, json=data)

        if nutrition_response.status_code != 200:
            return jsonify({
                "error": "Failed to fetch nutritional information",
                "details": nutrition_response.text
            }), 500

        nutrition_data = nutrition_response.json()

        # Process nutritional information
        filtered_nutrition = {
            "Calories": 0,
            "Carbohydrates": 0,
            "Protein": 0,
            "Fat": 0,
            "Sodium Content": 0,
            "Potassium Content": 0,
            "Magnesium Content": 0,
            "Calcium Content": 0,
            "Fiber Content": 0
        }

        for item in nutrition_data.get("foods", []):
            filtered_nutrition["Calories"] += item.get("nf_calories", 0)
            filtered_nutrition["Carbohydrates"] += item.get("nf_total_carbohydrate", 0)
            filtered_nutrition["Protein"] += item.get("nf_protein", 0)
            filtered_nutrition["Fat"] += item.get("nf_total_fat", 0)
            filtered_nutrition["Sodium Content"] += item.get("nf_sodium", 0)
            filtered_nutrition["Potassium Content"] += item.get("nf_potassium", 0)
            filtered_nutrition["Magnesium Content"] += item.get("nf_magnesium", 0)
            filtered_nutrition["Calcium Content"] += item.get("nf_calcium", 0)
            filtered_nutrition["Fiber Content"] += item.get("nf_dietary_fiber", 0)

        # Calculate Glycemic Index using the ML model
        input_data = pd.DataFrame({
            'Calories': [filtered_nutrition["Calories"]],
            'Carbohydrates': [filtered_nutrition["Carbohydrates"]],
            'Protein': [filtered_nutrition["Protein"]],
            'Fat': [filtered_nutrition["Fat"]],
            'Sodium Content': [filtered_nutrition["Sodium Content"]],
            'Potassium Content': [filtered_nutrition["Potassium Content"]],
            'Magnesium Content': [filtered_nutrition["Magnesium Content"]],
            'Calcium Content': [filtered_nutrition["Calcium Content"]],
            'Fiber Content': [filtered_nutrition["Fiber Content"]]
        })

        # Scale the input data and predict glycemic index
        scaled_input = scaler.transform(input_data)
        predicted_gi = rf_model.predict(scaled_input)[0]

        # Calculate glycemic load
        predicted_gl = (predicted_gi * filtered_nutrition["Carbohydrates"]) / 100

        return jsonify({
            "glycemic_index": float(predicted_gi),
            "glycemic_load": float(predicted_gl)
        }), 200

    except Exception as e:
        print("Error calculating glycemic values:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/get', methods=['GET'])
def get_route():
    # Return a success response
    return jsonify({"message": "Success"}), 200

@app.route('/analyze_nutrition', methods=['POST'])
@require_auth
def analyze_nutrition():
    try:
        logger.debug("Process image endpoint hit")
        logger.debug(f"Request headers: {request.headers}")

        # Validate JSON request
        if not request.is_json:
            logger.error("Request is not JSON")
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400

        data = request.json

        # Check if image data is provided
        if 'image' not in data:
            logger.error("No image in request")
            return jsonify({'status': 'error', 'message': 'No image data provided'}), 400

        # Extract image data
        image_data = data['image']
        logger.debug(f"Received image data length: {len(image_data)}")

        # Remove base64 prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Base64 decode error: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Invalid base64 data'}), 400

        # Create temporary file for image processing
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_file.write(image_bytes)
            file_path = temp_file.name

        # Process image with YOLO
        image = cv2.imread(file_path)
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = yolo_model.predict(image)

        # Extract bounding boxes
        bboxes = results[0].boxes.xyxy.cpu().numpy()
        
        if len(bboxes) == 0:
            return jsonify({'status': 'error', 'message': 'No nutrition label detected'}), 400

        # Crop the nutrition label area
        bbox = bboxes[0]  # Take the first detected label
        x1, y1, x2, y2 = map(int, bbox)
        cropped_img = img_rgb[y1:y2, x1:x2]
        
        # Save the cropped image
        cropped_path = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False).name
        cv2.imwrite(cropped_path, cv2.cvtColor(cropped_img, cv2.COLOR_RGB2BGR))

        # Upload image to Gemini
        uploaded_image = genai.upload_file(cropped_path, mime_type="image/jpeg")

        # Start Gemini chat for nutrition extraction
        chat_session = gemini_model.start_chat(history=[{
            "role": "user",
            "parts": [
                uploaded_image,
                ("I have an image of a food product containing a nutrition label. Your task is to extract and organize the nutritional information from this label into a JSON object that exactly follows the structure below. Do not include any extra keys, text, markdown formatting, or explanations—only output the JSON object starting with '{' and ending with '}'."  
                  "{\n"
                    "  \"serving_size\": \"\",\n"
                    "  \"nutrients\": {\n"
                    "    \"Energy\": {\"unit\": \"\", \"per_serve\": 0, \"per_100g\": 0},\n"
                    "    \"Protein\": {\"unit\": \"\", \"per_serve\": 0, \"per_100g\": 0},\n"
                    "    ... (other nutrients)\n"
                    "  }\n"  
                  "Important Guidelines:"  
                  "1. Exact Keys Only: Only use the nutrient names provided (Energy, Carbohydrate, Protein, Total Fat, Sodium, Potassium, Magnesium, Calcium, Fiber). If the label uses alternative names (for example, 'Total Carbohydrates'), map them to the specified key (e.g., 'Carbohydrate')."  
                  "2. Output Format: Output only the JSON object without any additional text or markdown formatting (for example, do not wrap your answer in triple backticks or any language tags)."  
                  "3. Consistency: Ensure that each nutrient follows the structure with keys 'unit', 'per_serve', and 'per_100g'."  
                  ""  
                  "Please extract the nutritional information accordingly and return only the JSON object as described."
                )
            ],
        }])

        response = chat_session.send_message("INSERT_INPUT_HERE")

        # Clean up the response text using regex
        cleaned_text = re.sub(r'```json\s*|\s*```', '', response.text)
        print("\n=== CLEANED GEMINI RESPONSE ===")
        print(cleaned_text)  # Print the cleaned response

        # Parse the cleaned JSON
        nutrition_data = json.loads(cleaned_text)
        logger.debug("Parsed Nutrition Data:")
        logger.debug(json.dumps(nutrition_data, indent=2))

        # Clean up temporary files
        os.unlink(file_path)
        os.unlink(cropped_path)

        # Return the extracted nutrition data
        result = {
            'status': 'success',
            'nutrition_data': nutrition_data,
        }
        logger.debug("Final Response:")
        logger.debug(json.dumps(result, indent=2))
        
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/update_nutrition', methods=['POST'])
@require_auth
def update_nutrition():
    try:
        # Get verified nutrition data from request
        verified_data = request.json
        if not verified_data:
            return jsonify({'error': 'No data provided'}), 400

        # Perform final calculations (glycemic index, load, and recommendation)
        glycemic_data = calculate_glycemic_data(verified_data)

        # Return the final results
        return jsonify({
            'processed_nutrition': glycemic_data['processed_nutrition'],
            'glycemic_index': glycemic_data['glycemic_index'],
            'glycemic_load': glycemic_data['glycemic_load'],
            'recommendation': glycemic_data['recommendation']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze_scanned_food', methods=['POST'])
@require_auth
def analyze_scanned_food():
    try:
        data = request.json
        print("\n=== RECEIVED DATA ===")
        print("Serving Size:", float(data.get('serving_size', 0)))
        print("Serving Unit:", data.get('serving_unit'))
        print("Raw Nutrients:", json.dumps(data.get('nutrients', {}), indent=2))

        serving_size = float(data.get('serving_size', 0))
        serving_unit = data.get('serving_unit')
        nutrients = data.get('nutrients', {})

        # Initialize calculated nutrition
        calculated_nutrition = {
            "Calories": 0,
            "Carbohydrates": 0,
            "Protein": 0,
            "Fat": 0,
            "Sodium Content": 0,
            "Potassium Content": 0,
            "Magnesium Content": 0,
            "Calcium Content": 0,
            "Fiber Content": 0
        }

        nutrient_mapping = {
            "Energy": "Calories",
            "Carbohydrate": "Carbohydrates",
            "Protein": "Protein",
            "Total Fat": "Fat",
            "Sodium": "Sodium Content",
            "Potassium": "Potassium Content",
            "Magnesium": "Magnesium Content",
            "Calcium": "Calcium Content",
            "Fiber": "Fiber Content"
        }

        print("\n=== CALCULATING NUTRITION VALUES ===")
        for frontend_name, backend_name in nutrient_mapping.items():
            if frontend_name in nutrients:
                nutrient_data = nutrients[frontend_name]
                print(f"\nProcessing {frontend_name}:")
                print(f"Original values: {nutrient_data}")
                
                if serving_unit == 'g':
                    value_per_100g = nutrient_data.get('per_100g', 0)
                    if value_per_100g is not None:
                        calculated_value = (value_per_100g * serving_size) / 100
                        print(f"Calculation (per 100g): {value_per_100g} * {serving_size} / 100 = {calculated_value}")
                        calculated_nutrition[backend_name] = calculated_value
                else:
                    value_per_serve = nutrient_data.get('per_serve', 0)
                    if value_per_serve is not None:
                        calculated_value = value_per_serve * serving_size
                        print(f"Calculation (per serve): {value_per_serve} * {serving_size} = {calculated_value}")
                        calculated_nutrition[backend_name] = calculated_value

        print("\n=== CALCULATED NUTRITION VALUES ===")
        print(json.dumps(calculated_nutrition, indent=2))

        # Prepare ML input data
        input_data = pd.DataFrame({
            'Calories': [calculated_nutrition["Calories"]],
            'Carbohydrates': [calculated_nutrition["Carbohydrates"]],
            'Protein': [calculated_nutrition["Protein"]],
            'Fat': [calculated_nutrition["Fat"]],
            'Sodium Content': [calculated_nutrition["Sodium Content"]],
            'Potassium Content': [calculated_nutrition["Potassium Content"]],
            'Magnesium Content': [calculated_nutrition["Magnesium Content"]],
            'Calcium Content': [calculated_nutrition["Calcium Content"]],
            'Fiber Content': [calculated_nutrition["Fiber Content"]]
        })

        print("\n=== ML MODEL INPUT ===")
        print(input_data)

        # Scale and predict
        scaled_input = scaler.transform(input_data)
        print("\n=== SCALED INPUT ===")
        print(scaled_input)

        predicted_gi = rf_model.predict(scaled_input)[0]
        print("\n=== PREDICTED GLYCEMIC INDEX ===")
        print(f"GI: {predicted_gi}")

        # Calculate glycemic load
        predicted_gl = (predicted_gi * calculated_nutrition["Carbohydrates"]) / 100
        print("\n=== CALCULATED GLYCEMIC LOAD ===")
        print(f"GL: {predicted_gl}")
        print(f"Calculation: ({predicted_gi} * {calculated_nutrition['Carbohydrates']}) / 100")

        final_response = {
            'nutrition': calculated_nutrition,
            'glycemic_index': float(predicted_gi),
            'glycemic_load': float(predicted_gl)
        }

        print("\n=== FINAL RESPONSE ===")
        print(json.dumps(final_response, indent=2))
        
        return jsonify(final_response), 200

    except Exception as e:
        print("\n=== ERROR ===")
        print("Error analyzing scanned food:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/get_recommendation', methods=['POST'])
@require_auth
def get_recommendation():
    try:
        user = request.user
        data = request.json

        # Get user's health details
        user_details = supabase.table('users')\
            .select('blood_sugar_level, medication_details')\
            .eq('id', user.id)\
            .execute()

        if not user_details.data:
            return jsonify({"error": "User details not found"}), 404

        user_health = user_details.data[0]
        today_glycemic = request.json.get('today_glycemic', {})
        scanned_glycemic = request.json.get('scanned_glycemic', {})

        # Updated prompt with more concise format
        prompt = (
            "You are a knowledgeable doctor and nutritionist specializing in diabetes care. "
            "Your task is to provide a concise dietary recommendation for a diabetes nutrition app. "
            "Based on the inputs below, decide if the scanned food item is safe for consumption and give a brief explanation. "
            "Your entire response must be limited to one or two sentences only.\n\n"
            "Inputs:\n"
            f"• Scanned Food Item Glycemic Index (GI): {scanned_glycemic.get('glycemic_index', 0)}\n"
            f"• User's Recent Blood Sugar Level: {user_health['blood_sugar_level']} mg/dL\n"
            f"• Medications: {user_health['medication_details']}\n"
            f"• Glycemic Index of Meals Already Consumed Today: {today_glycemic.get('glycemic_index', 0)}\n\n"
            "Instructions for Response:\n"
            "1. If the food is safe to consume, provide one sentence that states the decision and a brief reason why. \n"
            "2. If the food is not safe to consume, provide two sentences: the first stating the decision and the second with a brief explanation of the potential impact on blood sugar levels.\n\n"
            "Now, please provide your answer."
        )

        # Make request to the ML model
        response = requests.post(
            "https://589e-34-168-31-63.ngrok-free.app/generate",
            json={
                "prompt": prompt,
                "max_length": 150  # Reduced max length for more concise responses
            }
        )

        if not response.ok:
            return jsonify({"error": "Failed to generate recommendation"}), 500

        recommendation_data = response.json()
        
        return jsonify({
            "recommendation": recommendation_data.get('response', '')
        }), 200

    except Exception as e:
        print("Error generating recommendation:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

