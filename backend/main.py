import json
import os
from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tinydb import TinyDB, Query
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores.faiss import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
import google.generativeai as genai
from dotenv import load_dotenv
from util import split_text_into_chunks, create_vector_store, extract_text

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

dbpath = 'database.json'
if os.path.exists(dbpath):
    os.remove(dbpath)
db = TinyDB(dbpath)
professors_table = db.table("professors")
with open('reviews.json', 'r') as file:
    data = json.load(file)
professors_table.insert_multiple(data['professors'])

class Professor(BaseModel):
    professor_id: str
    name: str
    course: str

class Review(BaseModel):
    professor_id: str
    rating: float
    review_text: str

class QuestionInput(BaseModel):
    question: str

def setup_conversation_chain(template):
    model = ChatGoogleGenerativeAI(model="gemini-pro", temperature=0.3)
    prompt = PromptTemplate(template=template, input_variables=["context", "question"])
    chain = load_qa_chain(model, chain_type="stuff", prompt=prompt)
    return chain

def refresh_vector_store():
    try:
        all_text = extract_text(professors_table)
        chunks = split_text_into_chunks(all_text)
        create_vector_store(chunks)
        return {"message": "Content uploaded and processed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "API Landing"}

@app.post("/add_professor")
async def add_professor(professor: Professor):
    if professors_table.search(Query().professor_id == professor.professor_id):
        raise HTTPException(status_code=400, detail="Professor ID already exists")
    professors_table.insert(professor.dict())
    refresh_vector_store()
    return {"message": "Professor added successfully"}

@app.post("/add_review")
async def add_review(review: Review):
    ProfessorQuery = Query()
    professor = professors_table.get(ProfessorQuery.professor_id == review.professor_id)
    if not professor:
        raise HTTPException(status_code=404, detail="Professor not found")

    professor.setdefault("reviews", []).append(review.dict())
    professors_table.update({"reviews": professor["reviews"]}, ProfessorQuery.professor_id == review.professor_id)
    refresh_vector_store()
    return {"message": "Review added successfully"}

@app.get("/professors")
async def get_professors():
    return professors_table.all()

@app.post("/ask")
async def ask_question(question_input: QuestionInput):
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        indexed_data = FAISS.load_local("reviews_index", embeddings, allow_dangerous_deserialization=True)
        docs = indexed_data.similarity_search(question_input.question)
        
        prompt_template = """
        Your alias is AI Rate Professor. Your task is to provide a thorough response based on the given context, ensuring all relevant details are included. 
        If the requested information isn't available, simply state, "please reframe your question", then answer based on your understanding, connecting with the context. 
        Don't provide incorrect information.\n\n
        Context: \n {context}?\n
        Question: \n {question}\n
        Answer:
        """
        
        chain = setup_conversation_chain(prompt_template)
        response = chain({"input_documents": docs, "question": question_input.question}, return_only_outputs=True)
        
        print(response["output_text"])
        return {"answer": response["output_text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    