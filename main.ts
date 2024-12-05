import { MongoClient, ObjectId } from "mongodb";
import { ProyectoModel, TareaModel, UsuarioModel } from "./tps.ts";
import { fromModelToProject, fromModelToTask, fromModelToUser } from "./utils.ts";

const mongo_url = "mongodb+srv://examen:nebrija@cluster0.h7shi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(mongo_url);
await client.connect();
console.info("DB connected");

const db = client.db("Practica4");
const usersCollection = db.collection<UsuarioModel>("usuarios");
const projectsCollection = db.collection<ProyectoModel>("proyectos");
const tasksCollection = db.collection<TareaModel>("tareas");

const handler = async (req: Request): Promise<Response> => {
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;

    if(method === "GET"){
        if(path === "/users"){
            
            const usuariosDB = await usersCollection.find().toArray();
            console.log(usuariosDB);
            const usuarios = usuariosDB.map(fromModelToUser);
            return new Response(JSON.stringify(usuarios), {status: 200});

        } else if(path === "/projects"){
            
          const projectsDB = await projectsCollection.find().toArray();
          console.log(projectsDB);
          const projects = await Promise.all(projectsDB.map((e) => fromModelToProject(e, usersCollection)));
          return new Response(JSON.stringify(projects), {status: 200});
        
        } else if (path === "/projects/by-user") {
          const userId = url.searchParams.get("user_id");
        
          if (!userId) {
            return new Response( JSON.stringify({ error: "El parametro 'user_id' es obligatorio." }), { status: 400 });
          }
        
          const projectsDB = await projectsCollection.find({ user_id: new ObjectId(userId) }).toArray();
          const projects = await Promise.all(projectsDB.map((e) => fromModelToProject(e, usersCollection)));
        
          return new Response(JSON.stringify(projects), { status: 200 });
        }
        else if(path === "/tasks"){
            
        const tasksDB = await tasksCollection.find().toArray();
        console.log(tasksDB);
        const tasks = await Promise.all(tasksDB.map((e) => fromModelToTask(e, projectsCollection, usersCollection)));
        return new Response(JSON.stringify(tasks), {status: 200});

        } else if (path === "/tasks/by-project") {
          const projectId = url.searchParams.get("project_id");
        
          if (!projectId) {
            return new Response(
            JSON.stringify({ error: "El parametro 'project_id' es obligatorio." }), { status: 400 });
          }
        
          const tasksDB = await tasksCollection.find({ project_id: new ObjectId(projectId) }).toArray();
        
          const tasks = await Promise.all(
            tasksDB.map((e) => fromModelToTask(e, projectsCollection, usersCollection)));
        
          return new Response(JSON.stringify(tasks), { status: 200 });
        }        
    
    }else if (method === "POST") {
      if (path === "/users") {
        const body = await req.json();
    
        if (!body.name || !body.email) {
          return new Response("Bad request: nombre e email requeridos", { status: 400 });
        }
    
        const usuario = await usersCollection.findOne({ email: body.email });
        if (usuario) {
          return new Response("Usuario existente", { status: 400 });
        }
    
        const { insertedId } = await usersCollection.insertOne({
          name: body.name,
          email: body.email,
          created_at: new Date(),
        });
    
        return new Response(
          JSON.stringify({
            id: insertedId.toString(),
            name: body.name,
            email: body.email,
            created_at: new Date(),
          }), { status: 201 });
          
      } else if(path === "/projects"){

        const body = await req.json();

        if (!body.name || !body.description || !body.start_date || !body.user_id) {
          return new Response(JSON.stringify({ error: "Campos requeridos: name, description, start_date, user_id."}), { status: 400 });
        }
  
        const user = await usersCollection.findOne({ _id: new ObjectId(body.user_id) });
        if (!user) {
            return new Response(JSON.stringify({ error: "Usuario no encontrado." }), { status: 404 });
        }
  
        const { insertedId } = await projectsCollection.insertOne({
            name: body.name,
            description: body.description,
            start_date: new Date(body.start_date),
            end_date: null,
            user_id: new ObjectId(body.user_id)
        });
  
        return new Response(
            JSON.stringify({
                id: insertedId.toString(),
                name: body.name,
                description: body.description,
                start_date: new Date(body.start_date).toISOString(),
                end_date: null,
                user_id: body.user_id
            }), { status: 201 });

      } else if(path === "/tasks"){

        const body = await req.json();

        if (!body.title || !body.description || !body.status || !body.due_date || !body.project_id) {
            return new Response(JSON.stringify({ error: "Campos requeridos: title, description, status, due_date, project_id." }), { status: 400 });
        }

        const project = await projectsCollection.findOne({ _id: new ObjectId(body.project_id) });
        if (!project) {
            return new Response(JSON.stringify({ error: "Proyecto no encontrado." }), { status: 404 });
        }

        const { insertedId } = await tasksCollection.insertOne({
            title: body.title,
            description: body.description,
            status: body.status,
            due_date: new Date(body.due_date),
            created_at: new Date(),
            project_id: new ObjectId(body.project_id),
        });

        return new Response(
            JSON.stringify({
                id: insertedId.toString(),
                title: body.title,
                description: body.description,
                status: body.status,
                created_at: new Date().toISOString(),
                due_date: new Date(body.due_date).toISOString(),
                project_id: body.project_id,
            }), { status: 201 });

      } else if(path === "/tasks/move"){
        const body = await req.json();

        if (!body.task_id || !body.destination_project_id || !body.origin_project_id) {
          return new Response(JSON.stringify({ error: "Campos requeridos: task_id, destination_project_id, origin_project_id." }), { status: 400 });
        }

        const task = await tasksCollection.findOne({ _id: new ObjectId(body.task_id), project_id: new ObjectId(body.origin_project_id)});
        
        if (!task) {
          return new Response(JSON.stringify({ error: "Tarea no encontrada en el proyecto de origen o ID de tarea incorrecto." }), { status: 404 });
        }

        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(body.task_id) },
          { $set: { project_id: new ObjectId(body.destination_project_id) }
        });

        if (result.modifiedCount === 0) {
          return new Response(JSON.stringify({ error: "Error al mover la tarea al proyecto de destino." }), { status: 500 });
        }

        return new Response(
          JSON.stringify({
            message: "Task moved successfully.",
            task: {
              id: body.task_id,
              title: task.title,
              project_id: body.destination_project_id,
            },
          }), { status: 200 });
      }
    } else if(method ==="DELETE"){
      if(path === "/users"){
        const userId = url.searchParams.get("id");

        console.log("id recibido para eliminar:", userId); 

        if (!userId) {
            return new Response("ID de usuario requerido", {status: 400});
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

        console.log("Usuario encontrado:", user);

        if (!user) {
            return new Response("Usuario no encontrado", { status: 404 });
        }

        const { deletedCount } = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        console.log("deletedCount:", deletedCount);

        if (deletedCount === 0) {
            return new Response("Error al eliminar el usuario", { status: 404 });
        }

        return new Response("Usuario eliminado correctamente", { status: 200 });

      } else if(path === "/projects"){

        const projectId = url.searchParams.get("id");

        if (!projectId) {
            return new Response("ID de proyecto requerido", { status: 400 });
        }

        const project = await projectsCollection.findOne({ _id: new ObjectId(projectId) });

        if (!project) {
            return new Response("Proyecto no encontrado", { status: 404 });
        }

        const { deletedCount } = await projectsCollection.deleteOne({ _id: new ObjectId(projectId) });

        if (deletedCount === 0) {
            return new Response("Error al eliminar el proyecto", { status: 500 });
        }

        return new Response("Proyecto eliminado correctamente", { status: 200 });

      } else if(path === "/tasks"){

        const taskId = url.searchParams.get("id");

        if (!taskId) {
            return new Response("ID de tarea requerido", { status: 400 });
        }

        const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });

        if (!task) {
            return new Response("Tarea no encontrada", { status: 404 });
        }

        const { deletedCount } = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });

        if (deletedCount === 0) {
            return new Response("Error al eliminar la tarea", { status: 404 });
        }

        return new Response("Tarea eliminada correctamente", { status: 200 });
      }

    }
    
    return new Response("Endpoint not found!", {status: 404});
}

Deno.serve({port: 3000}, handler);