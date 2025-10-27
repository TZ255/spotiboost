require('dotenv').config();
const path = require('path');
const express = require('express');
const layouts = require('express-ejs-layouts');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const flash = require('connect-flash');
const { connectDB } = require('./config/db');
const initPassport = require('./config/passport');

const app = express();

// Settings
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(layouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// Database & Auth
(async () => {
  try {
    await connectDB(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (e) {
    console.error('Mongo connection error:', e.message);
  }
})();

const sessionName = process.env.SESSION_NAME || 'sb.sid';
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 7; // 7 days
app.use(
  session({
    name: sessionName,
    secret: process.env.SESSION_SECRET || 'changeme',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: sessionMaxAgeMs },
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: Math.floor(sessionMaxAgeMs / 1000),
      autoRemove: 'native'
    })
  })
);

initPassport(passport);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Locals
app.use(require('./middlewares/attachLocals'));

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));
app.use('/blog', require('./routes/blog'));

// 404 and error handlers
const { notFound, serverError } = require('./middlewares/errorHandler');
app.use(notFound);
app.use(serverError);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Spoti Boost inasikiliza http://localhost:${PORT}`);
});
