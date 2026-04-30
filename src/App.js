
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Blog from './Blog';  // Ensure Blog.jsx is correctly imported
import Navbar from './components/Navbar';  // Ensure Navbar has links

function App() {
  return (
    <Router>
      <div>
        <Navbar />  {/* Make sure Navbar with links is correctly placed */}
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
