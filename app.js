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
const MONGO_URI = "mongodb+srv://admin:biblioteca2845@cluster0.jbyog90.mongodb.net/?appName=Cluster0"; 
mongoose.connect(MONGO_URI).then(() => console.log("Biblioteca Conectada"));

// --- MODELOS ---
const Libro = mongoose.model('Libro', { titulo: String, autor: String, genero: String, portada: String });
const Reserva = mongoose.model('Reserva', { nombreAlumno: String, curso: String, fechaPrestamo: String, libroTitulo: String, passDevolucion: String });
const Inscripcion = mongoose.model('Inscripcion', { nombre: String, apellidos: String, curso: String, fecha: String });
const Admin = mongoose.model('Admin', { user: String, pass: String });

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'biblio-mega-secret', resave: false, saveUninitialized: false }));

// --- LÓGICA DE ADMIN (PIN 2845 o 3756) ---
app.post('/auth-admin', async (req, res) => {
    const { user, pass, pin, accion } = req.body;
    if (accion === 'registro') {
        // Acepta cualquiera de los dos códigos para crear admin
        if (pin === '2845' || pin === '3756') {
            await new Admin({ user, pass }).save();
            return res.send('Bibliotecario registrado. <a href="/">Entrar</a>');
        } else {
            return res.send('PIN incorrecto. <a href="/">Volver</a>');
        }
    }
    const a = await Admin.findOne({ user, pass });
    if (a) { req.session.admin = a.user; res.redirect('/'); }
    else res.send('Usuario o contraseña de admin fallida.');
});

// --- LÓGICA DE BORRADO ---
app.post('/borrar/:coleccion/:id', async (req, res) => {
    if (!req.session.admin) return res.send('No eres admin');
    const { coleccion, id } = req.params;
    if (coleccion === 'libro') await Libro.findByIdAndDelete(id);
    if (coleccion === 'inscripcion') await Inscripcion.findByIdAndDelete(id);
    if (coleccion === 'reserva') await Reserva.findByIdAndDelete(id);
    res.redirect('/');
});

// --- LÓGICA DE LIBROS ---
app.post('/add-libro', upload.single('portada'), async (req, res) => {
    if (!req.session.admin) return res.redirect('/');
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

// --- LÓGICA DE RESERVAS E INSCRIPCIÓN ---
app.post('/reservar', async (req, res) => {
    await new Reserva(req.body).save();
    res.send('Libro reservado con éxito. <a href="/">Volver</a>');
});

app.post('/devolver/:id', async (req, res) => {
    const r = await Reserva.findById(req.params.id);
    if (r && r.passDevolucion === req.body.passCheck) {
        await Reserva.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } else {
        res.send('Contraseña de devolución incorrecta.');
    }
});

app.post('/inscribirse', async (req, res) => {
    await new Inscripcion({ ...req.body, fecha: new Date().toLocaleDateString() }).save();
    res.send('Solicitud de carnet enviada. <a href="/">Volver</a>');
});

app.get('/salir', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- INTERFAZ ---
app.get('/', async (req, res) => {
    const libros = await Libro.find();
    const reservas = await Reserva.find();
    const inscritos = await Inscripcion.find();
    
    res.send(`
        <html>
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family:sans-serif; background:#f0f2f5; margin:0; }
                header { background:#2c3e50; color:white; padding:15px; text-align:center; }
                .tabs { display:flex; background:white; position:sticky; top:0; z-index:100; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
                .tab { flex:1; text-align:center; padding:15px; cursor:pointer; font-weight:bold; color:#666; border-bottom:3px solid transparent; }
                .tab.active { color:#e67e22; border-bottom-color:#e67e22; }
                .container { max-width:600px; margin:20px auto; padding:0 15px; }
                .section { display:none; } .section.active { display:block; }
                .card { background:white; padding:15px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.06); position:relative; overflow:hidden;}
                input, select, button, textarea { width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; box-sizing:border-box; }
                .portada-mini { width:70px; height:100px; object-fit:cover; border-radius:5px; float:left; margin-right:15px; }
                .btn-del { background:#ff7675; color:white; border:none; padding:5px; border-radius:5px; cursor:pointer; width:auto; font-size:0.8em; }
            </style>
        </head>
        <body>
            <header>
                <h2>📚 Panel de Biblioteca</h2>
                ${req.session.admin ? `<small>Conectado: ${req.session.admin} | <a href="/salir" style="color:white;">Cerrar sesión</a></small>` : '<small>Sección de Alumnos</small>'}
            </header>

            <div class="tabs">
                <div class="tab active" onclick="ver('libros', this)">Catálogo</div>
                <div class="tab" onclick="ver('reservas', this)">Reservas</div>
                <div class="tab" onclick="ver('inscripcion', this)">Carnet</div>
                <div class="tab" onclick="ver('admin', this)">🔑</div>
            </div>

            <div class="container">
                <div id="sec-libros" class="section active">
                    ${req.session.admin ? `
                        <div class="card" style="border:2px solid #e67e22;">
                            <h4>Añadir Libro</h4>
                            <form action="/add-libro" method="POST" enctype="multipart/form-data">
                                <input name="titulo" placeholder="Título" required>
                                <input name="autor" placeholder="Autor" required>
                                <select name="genero">
                                    <option value="Aventura">Aventura</option><option value="Misterio">Misterio</option>
                                    <option value="Ciencia">Ciencia</option><option value="Cómic">Cómic</option>
                                </select>
                                <input type="file" name="portada" required>
                                <button style="background:#e67e22; color:white;">Guardar en Nube</button>
                            </form>
                        </div>
                    ` : ''}
                    ${libros.map(l => `
                        <div class="card">
                            <img src="${l.portada}" class="portada-mini">
                            <b>${l.titulo}</b><br><small>${l.autor}</small><br>
                            <span style="font-size:0.8em; color:gray;">${l.genero}</span>
                            ${req.session.admin ? `
                                <form action="/borrar/libro/${l._id}" method="POST" style="margin-top:10px; clear:both;">
                                    <button class="btn-del">🗑️ Eliminar Libro</button>
                                </form>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>

                <div id="sec-reservas" class="section">
                    <div class="card">
                        <h4>Pedir Libro</h4>
                        <form action="/reservar" method="POST">
                            <input name="nombreAlumno" placeholder="Nombre y Apellidos" required>
                            <input name="curso" placeholder="Curso (Ej: 4ºA)" required>
                            <select name="libroTitulo">
                                ${libros.map(l => `<option value="${l.titulo}">${l.titulo}</option>`).join('')}
                            </select>
                            <input type="date" name="fechaPrestamo" required>
                            <input type="password" name="passDevolucion" placeholder="Crea una contraseña para devolverlo" required>
                            <button style="background:#2ecc71; color:white;">Confirmar Préstamo</button>
                        </form>
                    </div>
                    ${reservas.map(r => `
                        <div class="card">
                            <b>${r.libroTitulo}</b><br>
                            <small>Alumno: ${r.nombreAlumno} (${r.curso})</small><br>
                            <small>Fecha: ${r.fechaPrestamo}</small>
                            <form action="/devolver/${r._id}" method="POST" style="margin-top:10px;">
                                <input type="password" name="passCheck" placeholder="Pass de devolución" required style="width:60%;">
                                <button style="width:35%; background:#e74c3c; color:white;">Devolver</button>
                            </form>
                            ${req.session.admin ? `
                                <form action="/borrar/reserva/${r._id}" method="POST">
                                    <button class="btn-del" style="width:100%; margin-top:5px;">🗑️ Forzar Devolución (Admin)</button>
                                </form>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>

                <div id="sec-inscripcion" class="section">
                    <div class="card">
                        <h4>Solicitud de Carnet de Biblioteca</h4>
                        <form action="/inscribirse" method="POST">
                            <input name="nombre" placeholder="Nombre" required>
                            <input name="apellidos" placeholder="Apellidos" required>
                            <input name="curso" placeholder="Curso" required>
                            <button style="background:#3498db; color:white;">Enviar Solicitud</button>
                        </form>
                    </div>
                    ${req.session.admin ? `
                        <h4>Solicitudes Pendientes</h4>
                        ${inscritos.map(i => `
                            <div class="card">
                                <b>${i.nombre} ${i.apellidos}</b> - ${i.curso}
                                <form action="/borrar/inscripcion/${i._id}" method="POST" style="margin-top:10px;">
                                    <button class="btn-del">🗑️ Borrar de la lista</button>
                                </form>
                            </div>
                        `).join('')}
                    ` : ''}
                </div>

                <div id="sec-admin" class="section">
                    <div class="card">
                        <h4>Acceso Bibliotecario</h4>
                        <form action="/auth-admin" method="POST">
                            <input name="user" placeholder="Usuario Admin" required>
                            <input name="pass" type="password" placeholder="Contraseña" required>
                            <input name="pin" placeholder="PIN Secreto (solo para registro)">
                            <button name="accion" value="login" style="background:#2c3e50; color:white;">Entrar</button>
                            <button name="accion" value="registro" style="background:none; border:none; color:gray; cursor:pointer;">Registrar nuevo Admin</button>
                        </form>
                    </div>
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

app.listen(PORT, () => console.log('Biblioteca lista'));

