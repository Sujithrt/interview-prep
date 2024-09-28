// src/App.js
import React, { useState } from 'react';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Implement login logic here (e.g., call an API)
    console.log('Logging in with:', { email, password });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    // Implement registration logic here (e.g., call an API)
    console.log('Registering with:', { username, email, password });
  };

  return (
    <div className="App">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>

      <form onSubmit={isLogin ? handleLogin : handleRegister}>
        {!isLogin && (
          <div>
            <label>Username:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        )}
        
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
      </form>

      <button onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Switch to Register' : 'Switch to Login'}
      </button>
    </div>
  );
}

export default App;
