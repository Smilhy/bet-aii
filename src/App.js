
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
<<<<<<< HEAD
import Blog from './Blog';  // Ensure Blog.jsx is correctly imported
=======
import Blog from './components/Blog';  // Ensure Blog.jsx is correctly imported
>>>>>>> 0c786a90af77765e33ade1bbb97435f4472b4bf4
import Navbar from './components/Navbar';  // Ensure Navbar has links

function App() {
  return (
    <Router>
      <div>
<<<<<<< HEAD
        <Navbar />  {/* Make sure Navbar with links is correctly placed */}
=======
        <Navbar />  {/* Ensure Navbar with links is correctly placed */}
>>>>>>> 0c786a90af77765e33ade1bbb97435f4472b4bf4
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/typy-ai" component={TypyAI} />
          <Route path="/statystyki" component={Statystyki} />
          <Route path="/blog" component={Blog} />  {/* Blog route is now active */}
        </Switch>
      </div>
    </Router>
  );
}

export default App;
