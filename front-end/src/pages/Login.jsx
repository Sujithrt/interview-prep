// src/Login.jsx
import React, { useState } from 'react';
import { Container, TextField, Button, Typography, Box, Grid } from '@mui/material';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    console.log('Logging in with:', { email, password });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    console.log('Registering with:', { username, email, password });
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, p: 4, boxShadow: 3, borderRadius: 2 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          {isLogin ? 'Login' : 'Register'}
        </Typography>

        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          {!isLogin && (
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              margin="normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <TextField
            label="Email"
            type="email"
            variant="outlined"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            label="Password"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button variant="contained" color="primary" type="submit" fullWidth sx={{ mt: 2 }}>
            {isLogin ? 'Login' : 'Register'}
          </Button>
        </form>

        <Grid container justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button onClick={() => setIsLogin(!isLogin)} color="secondary">
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </Button>
        </Grid>
      </Box>
    </Container>
  );
}

export default Login;
