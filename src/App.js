
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Blog from './Blog';  // Import the Blog component
import Navbar from './components/Navbar';  // Navbar for navigation

function App() {
  return (
    <Router>
      <div>
        <Navbar />  {/* Make sure Navbar is included */}
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/typy-ai" component={TypyAI} />
          <Route path="/statystyki" component={Statystyki} />
          <Route path="/blog" component={Blog} />  {/* Add Blog route */}
        </Switch>
      </div>
    </Router>
  );
}

export default App;
