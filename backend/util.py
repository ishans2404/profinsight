import json
from tinydb import TinyDB
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores.faiss import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# # Initialize TinyDB
# db = TinyDB('database.json')
# professors_table = db.table("professors")

# def load_data(json_path):
#     with open(json_path, 'r') as file:
#         data = json.load(file)
#     professors_table.insert_multiple(data['professors'])

def extract_text(arg_prof_table):
    all_text = ""
    for professor in arg_prof_table.all():
        all_text += f"Professor ID: {professor['professor_id']}, Name: {professor['name']}, Course: {professor['course']}\n"
        for review in professor.get('reviews', []):
            all_text += f"Rating: {review['rating']}, Review: {review['review_text']}\n"
    return all_text

def split_text_into_chunks(text):
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    return splitter.split_text(text)

def create_vector_store(chunks):
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    vector_store = FAISS.from_texts(chunks, embedding=embeddings)
    vector_store.save_local("reviews_index")


# Load initial data from JSON and populate vector store
# json_path = 'reviews.json'
# load_data(json_path)
