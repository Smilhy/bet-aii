
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Blog from './components/Blog'; // Upewnij się, że Blog.jsx jest w folderze components

function App() {
  return (
    <Router>
      <div>
        <Switch>
          <Route path="/blog" component={Blog} />
          {/* Dodaj inne trasy jeśli potrzeba */}
        </Switch>
      </div>
    </Router>
  );
}

export default App;
