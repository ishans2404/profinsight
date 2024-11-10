import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  AppBar, 
  Toolbar, 
  DialogActions,
  Snackbar,
  Alert,
  Fade
} from '@mui/material';
import { styled } from '@mui/system';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import cloud from 'd3-cloud';
import { nest } from 'd3-collection';
import * as d3 from 'd3';
import ReactRating from 'react-rating';
import Sentiment from 'sentiment';
import ParticlesComponent from './particles';
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './LandingPage';

const DashboardContainer = styled(Box)(({ theme }) => ({
  backgroundColor: 'black',
  color: 'white',
  minHeight: '100vh',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
}));

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  color: 'white',
  height: '100%',
  borderRadius: '1rem',
}));

const ScrollableTableContainer = styled(TableContainer)(({ theme }) => ({
  maxHeight: 400,
  overflow: 'auto',
  backgroundColor: 'transparent',
}));

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function Insights({ profData }) {
  const navigate = useNavigate(); 
  const [data, setData] = useState(profData);
  const [averageRatings, setAverageRatings] = useState([]);
  const [courseDistribution, setCourseDistribution] = useState([]);
  const [topProfessors, setTopProfessors] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [selectedProfessor, setSelectedProfessor] = useState(null);
  const [newReview, setNewReview] = useState({ professor: '', rating: 5, reviewText: '' });
  const [reviewSentiments, setReviewSentiments] = useState([]);
  const [wordCloudData, setWordCloudData] = useState([]);
  const wordCloudRef = useRef(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    if (data && data.professors) {
      const ratings = data.professors.map(prof => ({
        name: prof.name,
        course: prof.course,
        averageRating: prof.reviews.reduce((sum, review) => sum + review.rating, 0) / prof.reviews.length
      }));
      setAverageRatings(ratings);

      const courses = {};
      data.professors.forEach(prof => {
        courses[prof.course] = (courses[prof.course] || 0) + 1;
      });
      setCourseDistribution(Object.entries(courses).map(([name, value]) => ({ name, value })));

      const sortedProfs = [...ratings].sort((a, b) => b.averageRating - a.averageRating);
      setTopProfessors(sortedProfs.slice(0, 5));

      // Calculate sentiments
      const sentiment = new Sentiment();
      const sentiments = data.professors.flatMap(prof => 
        prof.reviews.map(review => ({
          text: review.review_text,
          score: sentiment.analyze(review.review_text).score
        }))
      );
      setReviewSentiments(sentiments);

      // Word Cloud Data Generation
      const words = data.professors.flatMap(prof => prof.reviews.map(review => review.review_text.split(/\s+/))).flat();
      const wordCount = nest()
        .key(d => d)
        .rollup(v => v.length)
        .entries(words);

      setWordCloudData(wordCount.map(d => ({ text: d.key, value: d.value * 5 }))); // Reduced size
    }
  }, [data]);

  useEffect(() => {
    if (wordCloudRef.current && wordCloudData.length > 0) {
      const layout = cloud()
        .size([600, 300])
        .words(wordCloudData.map(d => ({ text: d.text, size: d.value })))
        .padding(5)
        .rotate(() => Math.random() * 90)
        .fontSize(d => d.size)
        .on('end', draw);

      layout.start();
    }

    function draw(words) {
      const svg = d3.select(wordCloudRef.current)
        .append('svg')
        .attr('width', 600)
        .attr('height', 300)
        .append('g')
        .attr('transform', `translate(${300},${150})`);

      svg.selectAll('text')
        .data(words)
        .enter().append('text')
        .style('font-size', d => `${d.size}px`)
        .style('fill', '#fff')
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text(d => d.text);
    }
  }, [wordCloudData]);

  const handleCourseChange = (event) => {
    setSelectedCourse(event.target.value);
    setCurrentPage(1);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  const handleReviewSubmit = () => {
    const reviewData = {
      professor_id: newReview.professor,
      rating: newReview.rating,
      review_text: newReview.reviewText,
    };
    console.log(reviewData);
    axios.post('http://127.0.0.1:8000/add_review', reviewData)
      .then(response => {
        setSnackbar({
          open: true,
          message: "Review added successfully!",
          severity: "success",
        });
        setNewReview({ professor: '', rating: 5, reviewText: '' });
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
    
            setData(transformedData);
            console.log(data);
          } catch (error) {
            console.error('Error fetching professor data:', error);
          }
        };
        fetchData();
      })
      .catch(error => {
        setSnackbar({
          open: true,
          message: error.response?.data?.detail || "Failed to add review.",
          severity: "error",
        });
      });
  };
  
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const filteredProfessors = data && data.professors
  ? data.professors
    .filter(prof => (selectedCourse === 'All' || prof.course === selectedCourse) &&
                 prof.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  : [];

  const sentimentData = reviewSentiments.reduce((acc, curr) => {
    if (curr.score > 0) acc.positive += 1;
    if (curr.score < 0) acc.negative += 1;
    if (curr.score === 0) acc.neutral += 1;
    return acc;
  }, { positive: 0, negative: 0, neutral: 0 });

  const handleViewDetails = (prof) => {
    setSelectedProfessor(prof);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const StyledAppBar = styled(AppBar)(({ theme }) => ({
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'none',
    transition: 'background 0.3s ease-in-out',
  }));

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    document.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  if (data && data.professors) {
    return (
      <>
      <StyledAppBar >
          <AppBar position="fixed" sx={{ bgcolor: scrolled ? 'rgba(0, 0, 0, 0.8)' : 'transparent', backdropFilter: 'blur(10px)', boxShadow: 'none', transition: 'background 0.3s ease-in-out',}}>
              <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Link to="/" style={{ textDecoration: 'none', color: '#fff' }}>
                          <Typography
                          variant="h6"
                          sx={{
                              flexGrow: 1,
                              cursor: 'pointer',
                              color: 'inherit',
                              '&:hover': {
                              textDecoration: 'none',
                              },
                          }}
                          >
                          ProfInsight
                          </Typography>
                      </Link>
                      </Box>
                  <SignedIn>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Button
                              color="inherit"
                              component={Link}
                              to="/chat"
                              sx={{
                              ml: 2,
                              marginRight: "1rem",
                              transform: 'translateY(-1px)',
                              }}
                          >
                              Chat
                          </Button>
                          <UserButton sx={{ transform: 'translateY(2px)' }} />
                      </Box>
                  </SignedIn>
                  <SignedOut>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <SignInButton mode="modal">
                      <Button color="inherit">SignIn</Button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                      <Button color="inherit" sx={{ ml: 1 }}>SignUp</Button>
                      </SignUpButton>
                  </Box>
                  </SignedOut>
              </Toolbar>
          </AppBar>
      </StyledAppBar>
      <DashboardContainer>
        <ParticlesComponent id="particles" />
        <Fade in={true} timeout={600}>
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h2" component="h1" gutterBottom textAlign="center">
            Professor Insights Dashboard
          </Typography>
          
          <FormControl fullWidth margin="normal">
          <InputLabel id="course-select-label" sx={{ color: 'white' }}>Course</InputLabel>
          <Select
              labelId="course-select-label"
              value={selectedCourse}
              onChange={handleCourseChange}
              label="Course"
              sx={{
              color: 'white',
              '& .MuiSelect-icon': {
                  color: 'white',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
              },
              '& .MuiInputLabel-root': {
                  color: 'white',
              },
              }}
          >
              <MenuItem value="All">All Courses</MenuItem>
              {Array.from(new Set(data.professors.map(prof => prof.course))).map(course => (
              <MenuItem key={course} value={course}>{course}</MenuItem>
              ))}
          </Select>
          </FormControl>

          <TextField
          label="Search Professors"
          variant="outlined"
          fullWidth
          margin="normal"
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{
              '& .MuiInputBase-input': {
              color: 'white',
              },
              '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'white',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'white',
              },
              '& .MuiInputLabel-root': {
              color: 'white',
              },
              '& .MuiInputBase-input::placeholder': {
              color: 'white',
              },
          }}
          />

          <Grid container spacing={5}>
            <Grid item xs={12}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Professor List</Typography>
                  <TableContainer component={Paper} sx={{ backgroundColor: 'transparent' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: 'white' }}>Name</TableCell>
                          <TableCell sx={{ color: 'white' }}>Course</TableCell>
                          <TableCell align="right" sx={{ color: 'white' }}>Average Rating</TableCell>
                          <TableCell sx={{ color: 'white' }}>Details</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredProfessors.map((prof) => (
                          <TableRow key={prof.name}>
                            <TableCell component="th" scope="row" sx={{ color: 'white' }}>
                              {prof.name}
                            </TableCell>
                            <TableCell sx={{ color: 'white' }}>
                              {prof.course}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'white' }}>
                              {averageRatings.find(r => r.name === prof.name)?.averageRating.toFixed(2) || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Button variant="contained" color="primary" onClick={() => handleViewDetails(prof)}>
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Pagination
                    count={Math.ceil(data.professors.length / itemsPerPage)}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    sx={{ 
                      marginTop: 2,
                      '& .MuiPaginationItem-root': {
                        color: 'white',
                      },
                      '& .MuiPaginationItem-ellipsis': {
                        color: 'white',
                      }
                    }}
                  />
                </CardContent>
              </StyledCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Average Ratings</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={averageRatings}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="averageRating" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </StyledCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Course Distribution</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={courseDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {courseDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </StyledCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Course Average Ratings</Typography>
                  <ScrollableTableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: 'white' }}>Course</TableCell>
                          <TableCell align="right" sx={{ color: 'white' }}>Average Rating</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {courseDistribution.map((course) => {
                          const avgRating = data.professors
                            .filter(prof => prof.course === course.name)
                            .reduce((sum, prof) => sum + prof.reviews.reduce((s, r) => s + r.rating, 0) / prof.reviews.length, 0) / course.value;
                          return (
                            <TableRow key={course.name}>
                              <TableCell sx={{ color: 'white' }}>{course.name}</TableCell>
                              <TableCell align="right" sx={{ color: 'white' }}>
                                {avgRating.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </CardContent>
              </StyledCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Review Sentiment Analysis</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(sentimentData).map(([key, value]) => ({ name: key, value }))}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </StyledCard>
            </Grid>

            <Grid item xs={12}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Review Word Cloud</Typography>
                  <div ref={wordCloudRef}></div>
                </CardContent>
              </StyledCard>
            </Grid>
          </Grid>


          <Dialog open={openDialog} onClose={handleCloseDialog}>
            <DialogTitle>Professor Details</DialogTitle>
            <DialogContent>
              {selectedProfessor && (
                <>
                  <Typography variant="h5">{selectedProfessor.name}</Typography>
                  <Typography variant="h6">Average Rating: {averageRatings.find(r => r.name === selectedProfessor.name)?.averageRating.toFixed(2) || 'N/A'}</Typography>
                  <Typography variant="h6">Course: {selectedProfessor.course}</Typography>
                  <Typography variant="h6">Reviews:</Typography>
                  <ul>
                    {selectedProfessor.reviews.map((review, index) => (
                      <li key={index}>
                        <Typography variant="body1">{review.review_text}</Typography>
                        <ReactRating
                          readonly
                          initialRating={review.rating}
                          emptySymbol="fa fa-star-o"
                          fullSymbol="fa fa-star"
                        />
                      </li>
                    ))}
                  </ul>
                  <SignedIn >
                    <StyledCard sx={{ backgroundColor: 'white', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
                      <CardContent>
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                          Add a Review
                        </Typography>

                        <TextField
                          label="Review Text"
                          variant="outlined"
                          fullWidth
                          margin="normal"
                          multiline
                          rows={4}
                          value={newReview.reviewText}
                          onChange={(e) => setNewReview({ ...newReview, reviewText: e.target.value, professor: selectedProfessor.professor_id })}
                          sx={{
                            '& .MuiInputBase-input': {
                              color: '#333',
                            },
                            '& .MuiOutlinedInput-root': {
                              borderColor: '#ddd',
                              borderRadius: 1,
                            },
                            '&:hover .MuiOutlinedInput-root': {
                              borderColor: '#999',
                            },
                            '& .MuiInputLabel-root': {
                              color: '#555',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#ddd',
                            },
                            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2', // Focus border color to match button
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: '#888',
                            }
                          }}
                        />

                        <FormControl fullWidth margin="normal">
                          <InputLabel id="rating-select-label" sx={{ color: '#555' }}>Rating</InputLabel>
                          <Select
                            labelId="rating-select-label"
                            value={newReview.rating}
                            onChange={(e) => setNewReview({ ...newReview, rating: e.target.value })}
                            label="Rating"
                            sx={{
                              color: '#333',
                              '& .MuiSelect-icon': {
                                color: '#333',
                              },
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#ddd',
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#999',
                              },
                              '& .MuiInputLabel-root': {
                                color: '#555',
                              },
                              '&:focus .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#1976d2',
                              },
                            }}
                          >
                            {[1, 2, 3, 4, 5].map(rating => (
                              <MenuItem key={rating} value={rating}>{rating}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleReviewSubmit}
                          sx={{
                            marginTop: 2,
                            color: 'white',
                            backgroundColor: '#1976d2',
                            '&:hover': {
                              backgroundColor: '#115293',
                            },
                            '&:focus': {
                              backgroundColor: '#115293',
                            },
                          }}
                        >
                          Submit Review
                        </Button>
                      </CardContent>
                    </StyledCard>
                    </SignedIn>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog} color="primary">Close</Button>
            </DialogActions>
          </Dialog>

          <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
              >
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                  {snackbar.message}
                </Alert>
              </Snackbar>
        </Container>
        </Fade>
      </DashboardContainer>
      </>
    );
  }
  else {
    setTimeout(() => {
      navigate('/');
    }, 3000);
    return (
      <>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
          }}
        >
          <Fade in={true} timeout={800}>
            <Card
              sx={{
                maxWidth: 400,
                textAlign: 'center',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #666', 
              }}
            >
              <Fade in={true} timeout={1000}>
                <CardContent>
                  <Typography
                    variant="h5"
                    gutterBottom
                  >
                    Something went wrong!!
                  </Typography>
                  <Typography variant="body1" paragraph>
                    You will be redirected to the home page shortly...
                  </Typography>
                </CardContent>
              </Fade>
            </Card>
          </Fade>
        </Box>
      </>
    );
  }
}
export default Insights;
