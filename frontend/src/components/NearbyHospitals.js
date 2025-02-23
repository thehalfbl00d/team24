import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, List, ListItem, Chip, TextField, Button } from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { PatientContext } from '../context/PatientContext';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '4px',
  flexGrow: 1
};

const fetchCoordinates = async (location) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${location}`);
  const data = await response.json();
  if (data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  throw new Error('Location not found');
};

const fetchNearbyHospitals = async (lat, lng) => {
  const query = `
    [out:json];
    (
      node["amenity"="hospital"](around:20000, ${lat}, ${lng});
      way["amenity"="hospital"](around:20000, ${lat}, ${lng});
      relation["amenity"="hospital"](around:20000, ${lat}, ${lng});
    );
    out center;
  `;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
  const data = await response.json();
  return data.elements;
};

const fetchRouteTimeAndDistance = async (startLat, startLng, endLat, endLng) => {
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=false`);
  const data = await response.json();
  const route = data.routes[0];
  return { time: route.duration, distance: route.distance };
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const NearbyHospitals = ({ patientDetails }) => {
  const [hospitals, setHospitals] = useState([]);
  const [nearestHospitals, setNearestHospitals] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState({ lat: 53.3498, lng: -6.2603 });
  const [locationInput, setLocationInput] = useState('Dublin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch hospitals based on patient address
  useEffect(() => {
    const fetchHospitals = async (lat, lng) => {
      setLoading(true);
      setError(null);
      try {
        const hospitalsData = await fetchNearbyHospitals(lat, lng);
        setHospitals(hospitalsData);
      } catch (err) {
        console.error('Failed to fetch hospitals', err);
        setError('Failed to fetch hospitals');
      } finally {
        setLoading(false);
      }
    };

    fetchHospitals(selectedLocation.lat, selectedLocation.lng);

    // Refresh data every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchHospitals(selectedLocation.lat, selectedLocation.lng);
    }, 300000);
    
    // Cleanup function
    return () => clearInterval(refreshInterval);
  }, [selectedLocation]); // Only depend on selectedLocation

  // Process and sort hospitals
  useEffect(() => {
    if (!hospitals.length) return;

    const processedHospitals = hospitals.map(hospital => ({
      ...hospital,
      distance: calculateDistance(
        selectedLocation.lat,
        selectedLocation.lng,
        hospital.lat,
        hospital.lon
      ),
      estimatedTime: Math.round(calculateDistance(
        selectedLocation.lat,
        selectedLocation.lng,
        hospital.lat,
        hospital.lon
      ) * 2) // Rough estimate: 2 minutes per km
    }));
    
    // Sort by distance and take top 5
    const sorted = [...processedHospitals]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    setNearestHospitals(sorted);
  }, [hospitals, selectedLocation]);

  const handleLocationSubmit = async () => {
    try {
      const coordinates = await fetchCoordinates(locationInput);
      setSelectedLocation(coordinates);
    } catch (error) {
      console.error('Failed to fetch coordinates', error);
      setError('Failed to fetch coordinates');
    }
  };

  return (
    <Grid container spacing={3} sx={{ height: '80vh' }}>
      <Grid item xs={12} md={8} sx={{ height: '100%' }}>
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <iframe
            title="Map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedLocation.lng - 0.05},${selectedLocation.lat - 0.05},${selectedLocation.lng + 0.05},${selectedLocation.lat + 0.05}&layer=mapnik`}
            style={mapContainerStyle}
          ></iframe>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
        <Paper sx={{ 
          p: 2, 
          height: '100%', 
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <Box sx={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'background.paper',
            pt: 2,
            pb: 2,
            zIndex: 1,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalHospitalIcon sx={{ mr: 1 }} />
              Nearby Hospitals
            </Typography>
            <Box sx={{ display: 'flex', mt: 2 }}>
              <TextField
                label="Location"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleLocationSubmit}
                sx={{ ml: 2 }}
              >
                Search
              </Button>
            </Box>
          </Box>
          <Box sx={{ 
            flexGrow: 1, 
            overflowY: 'auto',
            mt: 1
          }}>
            {error && (
              <Typography color="error" sx={{ p: 2, textAlign: 'center' }}>
                {error}
              </Typography>
            )}
            {!error && hospitals.length === 0 && !loading && (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No hospitals found in this area
              </Typography>
            )}
          <List>
            {nearestHospitals.map((hospital) => (
              <ListItem key={hospital.id || hospital.osm_id} sx={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: 1, 
                mb: 1,
                backgroundColor: hospital.tags.amenity === 'hospital' ? '#fff3e0' : '#fff'
              }}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1">
                      {hospital.tags?.name || hospital.name || 'Unnamed Hospital'}
                    </Typography>
                    <Chip 
                      size="small"
                      label={hospital.tags?.amenity === 'hospital' ? 'Hospital' : hospital.tags?.healthcare || 'Medical'}
                      color={hospital.tags?.emergency === 'yes' ? 'warning' : 'default'}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <LocationOnIcon sx={{ mr: 1, fontSize: '0.9rem' }} />
                    <Typography variant="body2" color="text.secondary">
                      {typeof hospital.distance === 'number' ? `${hospital.distance.toFixed(2)} km away` : 'Distance unavailable'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AccessTimeIcon sx={{ mr: 1, fontSize: '0.9rem' }} />
                    <Typography variant="body2" color="text.secondary">
                      ETA: {typeof hospital.estimatedTime === 'number' ? `${hospital.estimatedTime} mins` : 'Time unavailable'}
                    </Typography>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default NearbyHospitals;
