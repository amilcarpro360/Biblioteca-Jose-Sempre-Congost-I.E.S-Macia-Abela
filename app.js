const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const app = express();

const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN ---
cloudinary.config({ 
  cloud_name: 'dvlbsl16g', 
  api_key: '721617469253873', 
  api_secret: 'IkWS7Rx0vD8ktW62IdWmlbhNTPk' 
});
const upload = multer(); 
const MONGO_URI = "mongodb+srv://admin:biblio1789@cluster0.5de0hkj.mongodb.net/?appName=Cluster0"; 
mongoose.connect(MONGO_URI).then(() => console.log("Biblioteca con Usuarios Conectada"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, genero: String, portada: String });
const Reserva = mongoose.model('Reserva', { usuario: String, curso: String, fechaPrestamo: String, libroTitulo: String });
const Inscripcion = mongoose.model('Inscripcion', { nombre: String, apellidos: String, curso: String, fecha: String });
const User = mongoose.model('User', { user: String, pass: String, rol: String }); // Rol: 'admin' o 'alumno'

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-auth-system', resave: false, saveUninitialized: false }));

// --- LÓGICA DE AUTENTICACIÓN ---
app.post('/auth', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        const rol = (pin === '2845' || pin === '3756') ? 'admin' : 'alumno';
        await new User({ user, pass, rol }).save();
        return res.send(`Cuenta de ${rol} creada. <a href="/">Entrar</a>`);
    }
    const u = await User.findOne({ user, pass });
    if (u) { 
        req.session.u = u.user; 
        req.session.rol = u.rol; 
        res.redirect('/'); 
    } else res.send('Usuario o contraseña incorrectos.');
});

// --- LÓGICA DE GESTIÓN (SOLO ADMIN) ---
app.post('/borrar/:coleccion/:id', async (req, res) => {
    if (req.session.rol !== 'admin') return res.send('No autorizado');
    const { coleccion, id } = req.params;
    if (coleccion === 'libro') await Libro.findByIdAndDelete(id);
    if (coleccion === 'inscripcion') await Inscripcion.findByIdAndDelete(id);
    if (coleccion === 'reserva') await Reserva.findByIdAndDelete(id);
    res.redirect('/');
});

app.post('/add-libro', upload.single('portada'), async (req, res) => {
    if (req.session.rol !== 'admin') return res.redirect('/');
    let img = "";
    if (req.file) {
        const r = await new Promise((resolve) => {
            let s = cloudinary.uploader.upload_stream({ folder: "biblio_libros" }, (e, resu) => resolve(resu));
            streamifier.createReadStream(req.file.buffer).pipe(s);
        });
        img = r.secure_url;
    }
    await new Libro({ ...req.body, portada: img }).save();
    res.redirect('/');
});

// --- LÓGICA DE PRÉSTAMOS ---
app.post('/reservar', async (req, res) => {
    if (!req.session.u) return res.send('Debes iniciar sesión');
    await new Reserva({
        usuario: req.session.u,
        curso: req.body.curso,
        libroTitulo: req.body.libroTitulo,
        fechaPrestamo: new Date().toLocaleDateString()
    }).save();
    res.redirect('/');
});

app.post('/devolver/:id', async (req, res) => {
    const r = await Reserva.findById(req.params.id);
    // Solo el dueño de la reserva o el admin pueden devolver
    if (r && (r.usuario === req.session.u || req.session.rol === 'admin')) {
        await Reserva.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } else res.send('No puedes devolver un libro que no es tuyo.');
});

app.post('/inscribirse', async (req, res) => {
    await new Inscripcion({ ...req.body, fecha: new Date().toLocaleDateString() }).save();
    res.send('Solicitud enviada. <a href="/">Volver</a>');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    if (!req.session.u) return res.send(`
        <body style="font-family:sans-serif; background:#2c3e50; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
            <form action="/auth" method="POST" style="background:white; padding:30px; border-radius:15px; width:300px; text-align:center;">
                <h2>📚 Acceso Biblioteca</h2>
                <input name="user" placeholder="Usuario" required style="width:100%; padding:10px; margin-bottom:10px;">
                <input name="pass" type="password" placeholder="Contraseña" required style="width:100%; padding:10px; margin-bottom:10px;">
                <input name="pin" placeholder="PIN (Solo para Admins)" style="width:100%; padding:10px; margin-bottom:15px;">
                <button name="accion" value="login" style="width:100%; background:#2c3e50; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer;">Entrar</button>
                <button name="accion" value="registro" style="background:none; border:none; color:gray; margin-top:10px; cursor:pointer;">Crear cuenta nueva</button>
            </form>
        </body>`);

    const libros = await Libro.find();
    const reservas = await Reserva.find();
    const inscritos = await Inscripcion.find();
    const esAdmin = req.session.rol === 'admin';
    
    res.send(`
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family:sans-serif; background:#f0f2f5; margin:0; }
                header { background:#2c3e50; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center; }
                .tabs { display:flex; background:white; position:sticky; top:0; z-index:100; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
                .tab { flex:1; text-align:center; padding:15px; cursor:pointer; font-weight:bold; color:#666; }
                .tab.active { color:#e67e22; border-bottom:3px solid #e67e22; }
                .container { max-width:600px; margin:20px auto; padding:0 15px; }
                .card { background:white; padding:15px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden; }
                input, select, button { width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; box-sizing:border-box; }
                .portada { width:70px; height:100px; object-fit:cover; border-radius:5px; float:left; margin-right:15px; }
                .section { display:none; } .section.active { display:block; }
                .btn-danger { background:#ff7675; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; }
            </style>
        </head>
        <body>
            <header>
                <b>📖 BiblioApp</b>
                <span>${req.session.u} (${req.session.rol}) | <a href="/salir" style="color:white; font-size:0.8em;">Salir</a></span>
            </header>

            <div class="tabs">
                <div class="tab active" onclick="ver('libros', this)">Libros</div>
                <div class="tab" onclick="ver('reservas', this)">Mis Préstamos</div>
                <div class="tab" onclick="ver('inscripcion', this)">Carnet</div>
            </div>

            <div class="container">
                <div id="sec-libros" class="section active">
                    ${esAdmin ? `
                        <div class="card" style="border:2px solid #e67e22;">
                            <h3>Panel Admin: Nuevo Libro</h3>
                            <form action="/add-libro" method="POST" enctype="multipart/form-data">
                                <input name="titulo" placeholder="Título" required>
                                <input name="autor" placeholder="Autor" required>
                                <select name="genero"><option>Aventura</option><option>Misterio</option><option>Ciencia</option></select>
                                <input type="file" name="portada" required>
                                <button style="background:#e67e22; color:white;">Añadir al Estante</button>
                            </form>
                        </div>
                    ` : ''}
                    
                    ${libros.map(l => `
                        <div class="card">
                            <img src="${l.portada}" class="portada">
                            <b>${l.titulo}</b><br><small>${l.autor}</small><br>
                            <form action="/reservar" method="POST" style="margin-top:10px;">
                                <input type="hidden" name="libroTitulo" value="${l.titulo}">
                                <input name="curso" placeholder="Tu curso" required style="width:50%; padding:5px;">
                                <button style="width:45%; background:#2ecc71; color:white; border:none; padding:6px; border-radius:5px;">Reservar</button>
                            </form>
                            ${esAdmin ? `<form action="/borrar/libro/${l._id}" method="POST"><button class="btn-danger" style="margin-top:5px; width:100%;">Borrar Libro</button></form>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div id="sec-reservas" class="section">
                    <h3>${esAdmin ? 'Todos los Préstamos' : 'Mis Libros'}</h3>
                    ${reservas.filter(r => esAdmin || r.usuario === req.session.u).map(r => `
                        <div class="card">
                            <b>${r.libroTitulo}</b><br>
                            <small>Usuario: ${r.usuario} | Curso: ${r.curso}</small><br>
                            <small>Fecha: ${r.fechaPrestamo}</small>
                            <form action="/devolver/${r._id}" method="POST" style="margin-top:10px;">
                                <button style="background:#e74c3c; color:white; border:none; padding:8px; border-radius:5px; width:100%;">Devolver Libro</button>
                            </form>
                        </div>
                    `).join('')}
                </div>

                <div id="sec-inscripcion" class="section">
                    <div class="card">
                        <h3>Solicitud de Carnet</h3>
                        <form action="/inscribirse" method="POST">
                            <input name="nombre" placeholder="Nombre" required>
                            <input name="apellidos" placeholder="Apellidos" required>
                            <input name="curso" placeholder="Curso" required>
                            <button style="background:#3498db; color:white; border:none;">Enviar Datos</button>
                        </form>
                    </div>
                    ${esAdmin ? `
                        <h3>Solicitudes Pendientes</h3>
                        ${inscritos.map(i => `
                            <div class="card">
                                ${i.nombre} ${i.apellidos} (${i.curso})
                                <form action="/borrar/inscripcion/${i._id}" method="POST"><button class="btn-danger" style="width:100%; margin-top:10px;">Borrar Solicitud</button></form>
                            </div>`).join('')}
                    ` : ''}
                </div>
            </div>

            <script>
                function ver(id, el) {
                    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.getElementById('sec-' + id).classList.add('active');
                    el.classList.add('active');
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log('Biblioteca con sistema de usuarios lista'));
