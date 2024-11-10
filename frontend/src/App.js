import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import LandingPage from './LandingPage';
import Chat from './Chat';
import Insights from './Insights';
import axios from 'axios';

function App() {
  const [professorsData, setProfessorsData] = useState([]);

  useEffect(() => {
    // fetch professor data from the FastAPI backend
    const fetchData = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/professors');
        const transformedData = {
          professors: response.data.map(prof => ({
            professor_id: prof.professor_id,
            name: prof.name,
            course: prof.course,
            reviews: prof.reviews.map(review => ({
              rating: review.rating,
              review_text: review.review_text
            }))
          }))
        };

        setProfessorsData(transformedData);
        console.log(transformedData);
      } catch (error) {
        console.error('Error fetching professor data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/insights" element={<Insights profData={professorsData} />} />
        <Route
          path="/chat"
          element={
            <>
              <SignedIn>
                <Chat />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
