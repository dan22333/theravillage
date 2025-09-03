import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ExerciseLibrary.css';

const ExerciseLibrary = ({ onBack }) => {
  const { token } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [exercises, selectedCategory, searchTerm]);

  const fetchExercises = async () => {
    try {
      setIsLoading(true);
      // For now, use mock data since we don't have the exercises API yet
      const mockExercises = [
        {
          id: 1,
          name: 'Deep Breathing Exercise',
          category: 'breathing',
          description: 'A simple breathing technique to help with anxiety and stress management.',
          instructions: 'Sit comfortably, close your eyes, and take slow, deep breaths. Inhale for 4 counts, hold for 4, exhale for 4.',
          duration: '5-10 minutes',
          difficulty: 'beginner',
          equipment: 'none'
        },
        {
          id: 2,
          name: 'Progressive Muscle Relaxation',
          category: 'relaxation',
          description: 'Systematically tense and relax different muscle groups to reduce physical tension.',
          instructions: 'Start with your toes and work up to your head, tensing each muscle group for 5 seconds then relaxing.',
          duration: '15-20 minutes',
          difficulty: 'beginner',
          equipment: 'none'
        },
        {
          id: 3,
          name: 'Mindfulness Meditation',
          category: 'meditation',
          description: 'Focus on the present moment to reduce stress and improve mental clarity.',
          instructions: 'Find a quiet place, sit comfortably, and focus on your breath or a specific object.',
          duration: '10-30 minutes',
          difficulty: 'beginner',
          equipment: 'none'
        },
        {
          id: 4,
          name: 'Cognitive Behavioral Therapy (CBT) Exercises',
          category: 'cbt',
          description: 'Identify and challenge negative thought patterns.',
          instructions: 'Write down negative thoughts, identify cognitive distortions, and reframe them positively.',
          duration: '15-30 minutes',
          difficulty: 'intermediate',
          equipment: 'journal'
        },
        {
          id: 5,
          name: 'Grounding Techniques',
          category: 'grounding',
          description: 'Use your senses to stay present and connected to the current moment.',
          instructions: 'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.',
          duration: '2-5 minutes',
          difficulty: 'beginner',
          equipment: 'none'
        },
        {
          id: 6,
          name: 'Journaling Prompts',
          category: 'journaling',
          description: 'Guided writing exercises to process emotions and experiences.',
          instructions: 'Write about your feelings, experiences, or answer specific prompts to gain insight.',
          duration: '10-20 minutes',
          difficulty: 'beginner',
          equipment: 'journal'
        }
      ];
      
      setExercises(mockExercises);
    } catch (err) {
      setError('Failed to fetch exercises');
      console.error('Error fetching exercises:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = exercises;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(exercise => exercise.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredExercises(filtered);
  };

  const categories = [
    { id: 'all', name: 'All Exercises' },
    { id: 'breathing', name: 'Breathing' },
    { id: 'relaxation', name: 'Relaxation' },
    { id: 'meditation', name: 'Meditation' },
    { id: 'cbt', name: 'CBT' },
    { id: 'grounding', name: 'Grounding' },
    { id: 'journaling', name: 'Journaling' }
  ];

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return '#4caf50';
      case 'intermediate': return '#ff9800';
      case 'advanced': return '#f44336';
      default: return '#666';
    }
  };

  return (
    <div className="exercise-library">
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>Exercise Library</h1>
      </div>

      <div className="library-container">
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category.id}
                className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="loading-message">
            Loading exercises...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="exercises-grid">
          {filteredExercises.map(exercise => (
            <div key={exercise.id} className="exercise-card">
              <div className="exercise-header">
                <h3>{exercise.name}</h3>
                <span 
                  className="difficulty-badge"
                  style={{ backgroundColor: getDifficultyColor(exercise.difficulty) }}
                >
                  {exercise.difficulty}
                </span>
              </div>
              
              <div className="exercise-category">
                {categories.find(cat => cat.id === exercise.category)?.name}
              </div>
              
              <p className="exercise-description">
                {exercise.description}
              </p>
              
              <div className="exercise-details">
                <div className="detail-item">
                  <span className="detail-label">Duration:</span>
                  <span className="detail-value">{exercise.duration}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Equipment:</span>
                  <span className="detail-value">{exercise.equipment}</span>
                </div>
              </div>
              
              <div className="exercise-instructions">
                <h4>Instructions:</h4>
                <p>{exercise.instructions}</p>
              </div>
              
              <div className="exercise-actions">
                <button className="action-btn primary">
                  Assign to Client
                </button>
                <button className="action-btn secondary">
                  Save to Favorites
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredExercises.length === 0 && !isLoading && (
          <div className="no-results">
            <p>No exercises found matching your criteria.</p>
            <button 
              className="reset-btn"
              onClick={() => {
                setSelectedCategory('all');
                setSearchTerm('');
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseLibrary;
