import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from './examples/obj-file-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

let debug = 0;
let factor = 1.5;
let direction = 0;
let move_dir = 0 ;
let tree_pos = vec3(0,0,0);
let TIMESTEP = 0;
const GRAVITY_VECTOR = vec3(0,1,0);

let attempts=0;

function calculateFrustumPlanes(viewMatrix, projectionMatrix) {
    let vpMatrix = projectionMatrix.times(viewMatrix);
    // console.log(vpMatrix);
    let planes = {
        left:   {},
        right:  {},
        top:    {},
        bottom: {},
        near:   {},
        far:    {}
    };
    planes.left = {
        x: vpMatrix[3][0] + vpMatrix[0][0],
        y: vpMatrix[3][1] + vpMatrix[0][1],
        z: vpMatrix[3][2] + vpMatrix[0][2],
        w: vpMatrix[3][3] + vpMatrix[0][3]
    };
    normalizePlane(planes.left);

    planes.right = {
        x: vpMatrix[3][0] - vpMatrix[0][0],
        y: vpMatrix[3][1] - vpMatrix[0][1],
        z: vpMatrix[3][2] - vpMatrix[0][2],
        w: vpMatrix[3][3] - vpMatrix[0][3]
    };
    normalizePlane(planes.right);

    // Bottom Plane
    planes.bottom = {
        x: vpMatrix[3][0] + vpMatrix[1][0],
        y: vpMatrix[3][1] + vpMatrix[1][1],
        z: vpMatrix[3][2] + vpMatrix[1][2],
        w: vpMatrix[3][3] + vpMatrix[1][3]
    };
    normalizePlane(planes.bottom);


    // Top Plane
    planes.top = {
        x: vpMatrix[3][0] - vpMatrix[0][0],
        y: vpMatrix[3][1] - vpMatrix[0][1],
        z: vpMatrix[3][2] - vpMatrix[0][2],
        w: vpMatrix[3][3] - vpMatrix[0][3]
    };
    normalizePlane(planes.top);

    // Near Plane
    planes.near = {
        x: vpMatrix[3][0] + vpMatrix[2][0],
        y: vpMatrix[3][1] + vpMatrix[2][1],
        z: vpMatrix[3][2] + vpMatrix[2][2],
        w: vpMatrix[3][3] + vpMatrix[2][3]
    };
    normalizePlane(planes.near);

    // Far Plane
    planes.far = {
        x: vpMatrix[3][0] - vpMatrix[2][0],
        y: vpMatrix[3][1] - vpMatrix[2][1],
        z: vpMatrix[3][2] - vpMatrix[2][2],
        w: vpMatrix[3][3] - vpMatrix[2][3]
    };
    normalizePlane(planes.far);

    return planes;
}

function normalizePlane(plane) {
    let length = Math.sqrt(plane.x * plane.x + plane.y * plane.y + plane.z * plane.z);
    plane.x /= length;
    plane.y /= length;
    plane.z /= length;
    plane.w /= length;
}

function isObjectWithinFrustum(object, frustumPlanes) {
    // Assuming the object has a position (center of bounding sphere) and a radius
    let center = object.pos;
    let radius = object.radius;

    // Check if the sphere is outside any of the frustum planes
    for (let plane in frustumPlanes) {
        let planeNormal = { x: frustumPlanes[plane].x, y: frustumPlanes[plane].y, z: frustumPlanes[plane].z };
        let distance = dotProduct(planeNormal, center) + frustumPlanes[plane].w;
        if (distance < -radius) {
            return false;
        }
    }
    // The object is inside all planes and therefore visible
    return true;
}
function dotProduct(a, b) {
    return a.x * b[0] + a.y * b[1] + a.z * b[2];
}
function delete_from_arr(array, index) {
    // console.log("hey!");
    // console.log(index);
    // console.log(array);
    let node = array[index];
    array.splice(index, 1);
    return node

}
function add_to_arr(array, node) {
    array.push(node);
}

class Player {
    // "pos" is the location of the center of the bottom face of the player
    constructor(pos) {
        this.pos = pos;
        this.vel = vec3(0,0,0);
        this.shape = new Shape_From_File("../assets/tinker.obj")
        // let texture = new Texture("../assets/straw.jpg");
        // this.material = new Material(new defs.Textured_Phong(),
        // {ambient: 0.5, diffusivity: .8, specularity: 1, texture: texture});
        this.material = new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: .4, color: hex_color("#A52A2A")});
        this.falling = false;
        this.time=0;
        this.squish = 1;
        this.model_transform = Mat4.identity();
        this.inRotation = false;
        this.fly_velocity = vec3(-1.5,3,2);
    }

    draw(context, program_state) {
        let player_transform = Mat4.translation(0,2,0).times(Mat4.translation(...this.pos)).times(Mat4.rotation(3*Math.PI/2,1,0,0));
        player_transform.pre_multiply(Mat4.scale(1,this.squish,1));
        this.shape.draw(context, program_state, player_transform, this.material);
    }

    // v is the vector to direct the jump
    jump(done,dir) {
        if (this.falling) return;
        this.time++;
        this.squish = Math.max(0.5, this.squish - (1-0.5)/20);
        if(!done) return;
        // Adjust jump time for responsiveness
        if (this.time <= 5) this.time = 10;
        else if (this.time > 5 && this.time <= 15) this.time = 13;
        else if (this.time > 15 && this.time <= 25) this.time = 20;
        else if (this.time > 25 && this.time <= 35) this.time = 30;
        else if (this.time > 35) this.time = 40;

        // Adjust velocity based on direction
        if (dir == 0) {
            // Jump forward
            this.vel = this.vel.plus(vec3(Math.min(5, 1.15 * this.time / 15), Math.min(7, 2 * this.time / 15), 0));
            move_dir = 0;
        } else if (dir == 1) {
            // Jump left
            this.vel = this.vel.plus(vec3(0, Math.min(7, 2 * this.time / 15), -1.0 * Math.min(7, 1.5 * this.time / 15)));
            move_dir = 1;
        } else if (dir == 2) {
            // Jump right - assuming similar mechanics but in the opposite direction of 'left'
            this.vel = this.vel.plus(vec3(0, Math.min(7, 2 * this.time / 15), Math.min(7, 1.5 * this.time / 15)));
            move_dir = 2;
        }else//dir == 3
        {
            this.vel = this.vel.plus(vec3( -1.0 * Math.min(5, 1.15 * this.time / 15), Math.min(7, 2 * this.time / 15), 0));
            move_dir = 3;
        }

        // Debugging adjustments
        if (debug) {
            if (direction == 0) {
                this.vel = this.vel.plus(vec3(1.9, 2.5, 0));
            } else {
                // Assuming debug effects for new direction are similar to existing ones
                this.vel = this.vel.plus(vec3(0, 2.5, direction == 1 ? -1.9 : 1.9));
            }
        }

        this.time = 0;
        this.squish = 1;
        this.falling = true;
        this.ifStarted = true;
    }

    // Updates position and velocity if currently falling
    update() {
        if (!this.falling) return;
        this.pos = this.pos.plus(this.vel.times(TIMESTEP));
        this.vel = this.vel.minus(GRAVITY_VECTOR.times(TIMESTEP));
    }

    // Land and adjust y-level to y
    land(block_x, block_y, block_z, y) {
        this.falling = false;
        this.pos[2] = block_z;
        this.pos[1] = y;
        this.pos[0] = block_x;
        this.vel = vec3(0,0,0);
    }

    fly(context, program_state) {
        // 确保有一个初始的模型变换矩阵
        if (!this.model_transform)
            this.model_transform = Mat4.identity();
        
        this.flying = true;
        const camera_position = program_state.camera_inverse.times(vec4(0, 0, 0, 1)).to3();
        const direction_to_camera = camera_position.minus(this.pos).normalized();
        
        // 假设玩家被炸飞时朝向天空，我们可以使用一个固定的旋转轴，例如Z轴或自定义轴
        const rotation_axis = vec3(0, 0, 1); // 这里使用Z轴作为示例，可以根据需要调整
    
        // 动画函数更新玩家的位置和旋转
        const animate = () => {
            if (!this.flying || program_state.animation_time >= this.fly_end_time) {
                this.flying = false;
                return;
            }
            
            this.pos = this.pos.plus(this.fly_velocity.times(TIMESTEP));
            // 以下两行新增旋转效果
            const angle_per_frame = this.fly_rotation_speed * TIMESTEP;
            this.model_transform = this.model_transform.times(Mat4.rotation(angle_per_frame, ...rotation_axis));
    
            // 如果需要，更新draw方法中的模型变换以反映当前的model_transform
            requestAnimationFrame(animate);
        };
        animate();
    }
       
}

class Bomb {
    constructor(pos) {
        this.fall_speed = Math.random()*1.5 + 1; // falling speed per second per unit distance 0.7 ~ 2
        this.regenerate_speed = Math.random() * 1.5 + 2.7 // time delay in second to create a new bomb
        this.pos = pos;
        this.height = pos[1]
        this.is_shown = true;
        this.is_alive = 1;
        this.regenerate_time = 0;
        this.shape = new Shape_From_File("../assets/objects/light.obj");
        this.material = new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: .4, color: hex_color("#333333")}); // Darker color

    }

    update_pos(pos)
    {
        this.pos = pos;
        pos[1] = 3;
    }

    start()
    {
        this.pos[1] = 5;
        this.is_alive = 1;
    }

    is_ready()
    {
        return this.is_alive === 2;
    }

    draw(context, program_state) {

        let t = program_state.animation_time / 1000;
        let dt = program_state.animation_delta_time/1000;
        if(this.is_alive === 0 )
        {
            this.regenerate_time -= dt;

            if(this.regenerate_time <= 0)
            {
                this.is_alive = 2;
            }

            return;
        }

        if(this.is_alive === -1)
        {
            this.regenerate_time = Math.random() * this.regenerate_speed;
            this.is_alive = 0;
            return;

        }

        if(this.is_alive === 1)
        {
            this.is_shown = true;
        }
        else
        {
            return;
        }

        if(!this.is_shown)
        {
            return;
        }

        if(this.pos[1] >= 0)
        {
            this.pos[1] -= this.fall_speed * dt;
        }
        else
        {
            this.is_shown = false;
            this.is_alive = -1
            return;
        }


        let bomb_transform =  Mat4.translation(0,this.height,0).times(Mat4.translation(...this.pos)).times(Mat4.rotation(Math.PI/2,1,0,0));
        // console.log(this.pos)
        this.shape.draw(context, program_state, bomb_transform, this.material);

    }
}

class Explosion{
    constructor(pos){
        this.pos = pos; // 爆炸的位置
        this.shape = new Shape_From_File("../assets/tinker.obj"); // 载入爆炸模型
        this.material = new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 0.4, color: hex_color("#FFA500")});
        this.alive = true; // 标记爆炸是否还应该被绘制
        this.duration = 1000; // 爆炸持续时间，例如1000毫秒
        this.startTime = Date.now();
    }

    draw(context, program_state) {
        if (!this.alive) return; // 如果爆炸已经结束，不再绘制
        let now = Date.now();
        if (now - this.startTime > this.duration) {
            this.alive = false; // 超过持续时间，标记为不活跃
            return;
        }

        // 绘制爆炸效果
        let model_transform = Mat4.translation(...this.pos);
        this.shape.draw(context, program_state, model_transform, this.material);
    }
}

class Texture_Scroll_X extends defs.Phong_Shader {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #6.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;

            void main() {

                float scroll_speed = 2.0;
                vec2 offset_tex_coord = f_tex_coord - vec2(animation_time * scroll_speed, 0.0);
               
                vec4 tex_color = texture2D(texture, offset_tex_coord);
                

                if( tex_color.w < .01 ) discard;    
                // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            }
        `;
    }
}
// class ReferenceLine{
//     constructor(pos, radius, height) {
//         this.pos = pos;
//         this.radius = radius;
//         this.height = height;

//         // Load the model file:
//       this.shapes = [
//         new defs.Cube(),
//         new defs.Cube(),
//         new defs.Cube(),
//         new defs.Cube(),
//         new defs.Cube(),
//         new defs.Cube(),
//         new defs.Cube(),
//         new defs.Cube(),
//     ];

//       // Non bump mapped:
//       this.mat = new Material(new defs.Phong_Shader(), {
//           color: hex_color("#228B22"),
//           ambient: .3, diffusivity: .5, specularity: .5,
//       });
//     }

//     draw(context, program_state,  t, color, shading, offset) {
//         for (let i = 0; i < 8; i++) {
//             this.shapes[i].draw();
//         }
//     }
// }

class Tree {
    // "pos" is the location of the center of the bottom face of the Tree
    constructor(pos, radius, height) {
        this.pos = pos;
        this.radius = radius;
        this.height = height;
        let random = Math.floor(Math.random() * 17);
        let shape_paths = [
            "../assets/objects/platform/Bear.obj",
            "../assets/objects/platform/Bird.obj",
            "../assets/objects/platform/Cat.obj",
            "../assets/objects/platform/Chicken.obj",
            "../assets/objects/platform/Cow.obj",
            "../assets/objects/platform/Dog.obj",
            "../assets/objects/platform/Dragon.obj",
            "../assets/objects/platform/Fox.obj",
            "../assets/objects/platform/Giraffe.obj",
            "../assets/objects/platform/Lion.obj",
            "../assets/objects/platform/Monkey.obj",
            "../assets/objects/platform/Owl.obj",
            "../assets/objects/platform/Panda.obj",
            "../assets/objects/platform/Pig.obj",
            "../assets/objects/platform/Rabbit.obj",
            "../assets/objects/platform/Sheeep.obj",
            "../assets/objects/platform/Tiger.obj",
        ];
        let texture_paths = [
            "../assets/objects/platform_texture/Bear.jpg",
            "../assets/objects/platform_texture/Bird.jpg",
            "../assets/objects/platform_texture/Cat.jpg",
            "../assets/objects/platform_texture/Chicken.jpg",
            "../assets/objects/platform_texture/Cow.jpg",
            "../assets/objects/platform_texture/Dog.jpg",
            "../assets/objects/platform_texture/Dragon.jpg",
            "../assets/objects/platform_texture/Fox.jpg",
            "../assets/objects/platform_texture/Giraffe.jpg",
            "../assets/objects/platform_texture/Lion.jpg",
            "../assets/objects/platform_texture/Monkey.jpg",
            "../assets/objects/platform_texture/Owl.jpg",
            "../assets/objects/platform_texture/Panda.jpg",
            "../assets/objects/platform_texture/Pig.jpg",
            "../assets/objects/platform_texture/Rabbit.jpg",
            "../assets/objects/platform_texture/Sheep.jpg",
            "../assets/objects/platform_texture/Tiger.jpg",
        ];

        let selected_shape_path = shape_paths[random];
        let selected_texture_path = texture_paths[random];

        this.shape = new Shape_From_File(selected_shape_path);
        let texture_t = new Texture(selected_texture_path);

        // if (random > 0.5){
        //     this.shape = new Shape_From_File("../assets/objects/platform/Bear.obj");
        // }
        // else if (random > 0){
        //     this.shape = new defs.Cube(30, 30);
        // }
        // else if (random > 0){
        //     this.shape = new defs.Cube(30, 30);
        // }
        // else if (random > 0){
        //     this.shape = new defs.Cube(30, 30);
        // }
        // this.shape = new defs.Capped_Cylinder(30, 30);

        this.disappear = false;

        // if (Math.random() > 2/3){
        //     texture_t = new Texture("../assets/stars.png");
        // }else {
        //     if (Math.random() > 1/3){
        //         texture_t = new Texture("../assets/earth.gif");
        //     }
        // }

        this.platform = new Material(new defs.Textured_Phong(),
            {ambient: 0.5, diffusivity: .8, specularity: 1, texture: texture_t});

    }

    draw(context, program_state, t, color, shading) {
        let tree_transform;
        if(direction == 0){
            tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,0.5,0).times(Mat4.rotation(-Math.PI/2,1,0,0)).times(Mat4.rotation(-Math.PI/2,0,0,1)));
        } else{
            tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,0.5,0).times(Mat4.rotation(-Math.PI/2,1,0,0)));
        }

        tree_transform.pre_multiply(Mat4.translation(...this.pos));
        //let tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,0.5,0).times(Mat4.translation(...this.pos).times(Mat4.rotation(Math.PI/2,1,0,0))));
        this.shape.draw(context, program_state, tree_transform, this.platform);
    }
}

class TreeBackground{
    constructor(pos, radius, height) {
        this.pos = pos;
        this.radius = radius;
        this.height = height;

        let random = Math.floor(Math.random() * 4);
        let shape_paths = [
            "../assets/objects/nature_set/Tree/Tree_1.obj",
            "../assets/objects/nature_set/Tree/Tree_2.obj",
            "../assets/objects/nature_set/Tree/Tree_3.obj",
            "../assets/objects/Lowpoly_tree_sample.obj",
        ];
        let selected_shape_path = shape_paths[random];

        this.shape = new Shape_From_File(selected_shape_path);

        // Non bump mapped:
        this.tree = new Material(new defs.Phong_Shader(), {
            color: hex_color("#00CC22"),
            ambient: .3, diffusivity: .5, specularity: .5,
        });
    }
    modify_pos(new_pos){
        this.pos = new_pos;
    }
    identify(){
        return 0;
    }
    draw(context, program_state,  t, color, shading, offset) {
        let tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,2,0));
        tree_transform.pre_multiply(Mat4.translation(...this.pos));
        tree_transform.pre_multiply(Mat4.translation(...offset));
        this.shape.draw(context, program_state, tree_transform, this.tree);
    }
}
class TrunkBackground{
    constructor(pos, radius, height) {
        this.pos = pos;
        this.radius = radius;
        this.height = height;

        let random = Math.floor(Math.random() * 3);
        let shape_paths = [
            "../assets/objects/nature_set/Trunk/Trunk_1.obj",
            "../assets/objects/nature_set/Trunk/Trunk_2.obj",
            "../assets/objects/nature_set/Trunk/Trunk_3.obj",
        ];
        let selected_shape_path = shape_paths[random];
        this.shape = new Shape_From_File(selected_shape_path);
        // Non bump mapped:
        this.trunk = new Material(new defs.Phong_Shader(), {
            color: hex_color("#7A4814"),
            ambient: .3, diffusivity: .5, specularity: .5,
        });
    }
    modify_pos(new_pos){
        this.pos = new_pos;
    }
    identify(){
        return 1;
    }
    draw(context, program_state,  t, color, shading, offset) {
        let tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,2,0));
        tree_transform.pre_multiply(Mat4.translation(...this.pos));
        tree_transform.pre_multiply(Mat4.translation(...offset));
        this.shape.draw(context, program_state, tree_transform, this.trunk);
    }
}
class StumpBackground{
    constructor(pos, radius, height) {
        this.pos = pos;
        this.radius = radius;
        this.height = height;

        let random = Math.floor(Math.random() * 3);
        let shape_paths = [
            "../assets/objects/nature_set/Stump/Stump_1.obj",
            "../assets/objects/nature_set/Stump/Stump_2.obj",
            "../assets/objects/nature_set/Stump/Stump_3.obj",
        ];
        let selected_shape_path = shape_paths[random];
        this.shape = new Shape_From_File(selected_shape_path);
        // Non bump mapped:
        this.Stump = new Material(new defs.Phong_Shader(), {
            color: hex_color("#7A4814"),
            ambient: .3, diffusivity: .5, specularity: .5,
        });
    }
    modify_pos(new_pos){
        this.pos = new_pos;
    }
    identify(){
        return 2;
    }
    draw(context, program_state,  t, color, shading, offset) {
        let tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,1.5,0));
        tree_transform.pre_multiply(Mat4.translation(...this.pos));
        tree_transform.pre_multiply(Mat4.translation(...offset));
        this.shape.draw(context, program_state, tree_transform, this.Stump);
    }
}
class LeafBackground{
    constructor(pos, radius, height) {
        this.pos = pos;
        this.radius = radius;
        this.height = height;

        let random = Math.floor(Math.random() * 3);
        let shape_paths = [
            "../assets/objects/nature_set/Leaves_pile/Leaves_pile_1.obj",
            "../assets/objects/nature_set/Leaves_pile/Leaves_pile_2.obj",
            "../assets/objects/nature_set/Leaves_pile/Leaves_pile_3.obj",
        ];
        let selected_shape_path = shape_paths[random];
        this.shape = new Shape_From_File(selected_shape_path);
        // Non bump mapped:
        this.Leaves_pile = new Material(new defs.Phong_Shader(), {
            color: hex_color("#75A907"),
            ambient: .3, diffusivity: .5, specularity: .5,
        });
    }
    modify_pos(new_pos){
        this.pos = new_pos;
    }
    identify(){
        return 3;
    }
    draw(context, program_state,  t, color, shading, offset) {
        let tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,1.5,0));
        tree_transform.pre_multiply(Mat4.translation(...this.pos));
        tree_transform.pre_multiply(Mat4.translation(...offset));
        this.shape.draw(context, program_state, tree_transform, this.Leaves_pile);
    }
}
class StoneBackground{
    constructor(pos, radius, height) {
        this.pos = pos;
        this.radius = radius;
        this.height = height;

        let random = Math.floor(Math.random() * 5);
        let shape_paths = [
            "../assets/objects/nature_set/Stone/StonePlatform_A.obj",
            "../assets/objects/nature_set/Stone/StonePlatform_B.obj",
            "../assets/objects/nature_set/Stone/StonePlatform_C.obj",
            "../assets/objects/nature_set/Stone/StonePlatform_D.obj",
            "../assets/objects/nature_set/Stone/StonePlatform_F.obj",
        ];
        let selected_shape_path = shape_paths[random];
        this.shape = new Shape_From_File(selected_shape_path);
        // Non bump mapped:
        this.Leaves_pile = new Material(new defs.Phong_Shader(), {
            color: hex_color("#40403E"),
            ambient: .3, diffusivity: .5, specularity: .5,
        });
    }
    modify_pos(new_pos){
        this.pos = new_pos;
    }
    identify(){
        return 4;
    }
    draw(context, program_state,  t, color, shading, offset) {
        let tree_transform = Mat4.scale(this.radius,this.height,this.radius).times(Mat4.translation(0,0.5,0));
        tree_transform.pre_multiply(Mat4.translation(...this.pos));
        tree_transform.pre_multiply(Mat4.translation(...offset));
        this.shape.draw(context, program_state, tree_transform, this.Leaves_pile);
    }
}
class Floor{
    constructor(pos, radius, height) {
        this.pos = vec3(0,1,0);
        this.radius = radius;
        this.height = height;
        let texture_t = new Texture("../assets/stars.png");

        // Load the model file:
        this.shapes = {
            // floor: new defs.Cube(),
            floor: new defs.Regular_2D_Polygon(20,20),
        };
        //   {ambient: 0, diffusivity: .8, specularity: 1, color: hex_color("#80FFFF")});
        //
        // Non bump mapped:
        this.floor = new Material(new defs.Textured_Phong(), {
            texture:texture_t, color: hex_color("#8B4513"),
            ambient: 0.5, diffusivity: 0.8, specularity: 1,
        });
    }

    draw(context, program_state, t, color, shading, offset) {
        let transform = Mat4.identity();// Mat4.scale(20,0,20);
        transform.pre_multiply(Mat4.rotation(Math.PI/2, 1, 0, 0));
        transform.pre_multiply(Mat4.scale(3,0,3));
        transform.pre_multiply(Mat4.translation(...this.pos));
        transform.pre_multiply(Mat4.translation(...offset));
        this.shapes.floor.draw(context, program_state, transform, this.floor);
        //set to true after player jumps off this block
    }
}
class SkyBox {
    constructor(center, size, side_color, bottom_color) {
        this.center = center;
        this.size = size;
        this.side_color = side_color;
        this.bottom_color = bottom_color; // 注意：这个属性可能不再需要，因为我们会直接使用贴图

        this.plate = new defs.Square();

        // 侧面使用单一颜色的材质
        this.material = new Material(new defs.Phong_Shader(), {
            color: hex_color("#8B4513"), ambient: 1, diffusivity: 0, specularity: 0
        });

        // 底部使用贴图的材质
        this.bottom_material = new Material(new defs.Textured_Phong(), {
            texture: new Texture("../assets/grass.png"),
            ambient: 1, diffusivity: 0, specularity: 0
        });
    }

    draw(context, program_state) {
        let translate = Mat4.translation(...this.center);
        let invtranslate = Mat4.translation(...this.center.map(x => -x));
        let transform = translate.times(
            Mat4.translation(0,-this.size,0).times(
                Mat4.rotation(Math.PI/2, 1, 0, 0).times(
                    Mat4.scale(this.size, this.size, 1))));

        // 绘制底部时使用带有贴图的材质
        this.plate.draw(context, program_state, transform, this.bottom_material);

        // 为了绘制四个侧面，将变换矩阵旋转并应用侧面的材质
        transform = translate.times(Mat4.rotation(-Math.PI/2, 1, 0, 0).times(invtranslate.times(transform)));
        for (let i = 0; i<4; i++) {
            this.plate.draw(context, program_state, transform, this.material.override({color:this.side_color}));
            transform = translate.times(Mat4.rotation(Math.PI/2, 0, 1, 0).times(invtranslate.times(transform)));
        }
    }

    update_center(center) {
        this.center = center;
    }
}

export class Game extends Scene {
    constructor() {

        super();
        this.jumpCount = 0; // 跳跃计数
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            test2: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#992828")}),
            ring: new Material(new defs.Phong_Shader()),
        }
        this.prepared_trees =[];
        this.prepared_trunks =[];
        this.prepared_stumps =[];
        this.prepared_leaves =[];
        this.prepared_stones =[];
        for(let i = 0; i < 30; i++){
            let treee = new TreeBackground(vec3(0,0,0),1+Math.random(),2+Math.random()*2);
            this.prepared_trees.push(treee);
        }
        for(let i = 0; i < 10; i++){
            let treee = new TrunkBackground(vec3(0,0,0),1+Math.random(),2+Math.random());
            this.prepared_trunks.push(treee);
        }
        for(let i = 0; i < 10; i++){
            let treee = new StumpBackground(vec3(0,0,0),0.4+Math.random(),0.5+Math.random()*0.5);
            this.prepared_stumps.push(treee);
        }
        for(let i = 0; i < 10; i++){
            let treee = new LeafBackground(vec3(0,0,0),0.4+Math.random(),0.25+Math.random()*0.25);
            this.prepared_leaves.push(treee);
        }
        for(let i = 0; i < 10; i++){
            let treee = new StoneBackground(vec3(0,0,0),0.5+Math.random(),0.5+Math.random());
            this.prepared_stones.push(treee);
        }
        this.light=new Light(vec4(5,5,5,0), color(1, 1, 1, 0.1), 100);
        this.init_game();

        this.explosions = [];

    }

    init_game(){
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        // Colors
        this.colors = [];
        this.time=0;
        direction=0;
        // *** Materials
        this.jumpCount = 0;
        this.gameOver=false;

        //true when you are on a block, hence stop movement
        this.onBlock=false;

        this.initial_camera_location = Mat4.look_at(vec3(-6*factor, 15*factor, 8*factor), vec3(0, 2, 0), vec3(0, 1, 0));
        this.desired_camera_location = this.initial_camera_location;
        // this.initial_camera_location = Mat4.look_at(vec3(5, 0, 60), vec3(5, 0, 0), vec3(0, 1, 0));
        this.lastX = 10;
        this.lastZ = 0;
        // Game initialization
        this.player = new Player(vec3(0,3,0));
        // this.trees = [new Tree(vec3(0,0,0),1,1), new Tree(vec3(5,0,0),1.5,1), new Tree(vec3(10,0,0),1.5,1), new Tree(vec3(15,0,0),1.5,1), new Tree(vec3(20,0,0),1,2)];


        this.trees = [new Tree(vec3(0,2,0),1,1), new Tree(vec3(this.lastX,2,0),1.5,1), new Tree(vec3(-this.lastX,2,0),1.5,1), new Tree(vec3(0,2,7),1.5,1), new Tree(vec3(0,2,-7),1.5,1)];
        this.tree_backgrounds = [];
        this.bomb = []
        // this.bomb = [ new Bomb(vec3(this.lastX,8,0)), new Bomb(vec3(-this.lastX,8,0)), new Bomb(vec3(0,8,7)), new Bomb(vec3(0,8,-7))] ;
        try {
            let cnt1 = Math.random();
            let cnt2 = Math.random();
            let bomb1, bomb2;
            // console.log(cnt1)

            if (cnt1 < 0.25)
            {
                bomb1 = new Bomb(vec3(this.lastX,8,0));
                if (cnt2 <0.33)
                {
                    bomb2 = new Bomb(vec3(-this.lastX,8,0));
                }
                else if (cnt2 >=0.33 && cnt2<=0.66)
                {
                    bomb2 = new Bomb(vec3(0,8,-7));
                }
                else
                {
                    bomb2 = new Bomb(vec3(0,8,7));
                }
            }
            else if(cnt1>=0.25 && cnt1<0.5)
            {
                bomb1 = new Bomb(vec3(-this.lastX,8,0));
                if (cnt2 <0.33)
                {
                    bomb2 = new Bomb(vec3(this.lastX,8,0));
                }
                else if (cnt2 >=0.33 && cnt2<=0.66)
                {
                    bomb2 = new Bomb(vec3(0,8,-7));
                }
                else
                {
                    bomb2 = new Bomb(vec3(0,8,7));
                }
            }
            else if( cnt1 >=0.5 && cnt1<0.75){
                bomb1 = new Bomb(vec3(0,8,7));
                if (cnt2 <0.33)
                {
                    bomb2 = new Bomb(vec3(-this.lastX,8,0));
                }
                else if (cnt2 >=0.33 && cnt2<=0.66)
                {
                    bomb2 = new Bomb(vec3(this.lastX,8,0));
                }
                else
                {
                    bomb2 = new Bomb(vec3(0,8,-7));
                }
            }
            else{
                bomb1 = new Bomb(vec3(0,8,-7));
                if (cnt2 <0.33)
                {
                    bomb2 = new Bomb(vec3(-this.lastX,8,0));
                }
                else if (cnt2 >=0.33 && cnt2<=0.66)
                {
                    bomb2 = new Bomb(vec3(this.lastX,8,0));
                }
                else
                {
                    bomb2 = new Bomb(vec3(0,8,7));
                }
            } 
            this.bomb = [bomb1, bomb2]
        } catch (error) {
            console.error(error);
            // 其他错误处理
        }

        this.plant_tree_background(this.lastX,this.trees[0].pos[0],this.trees[0].pos[2],0);

        this.floor = new Floor();
        this.skybox = new SkyBox(this.player.pos.plus(vec3(0,20,0)), 25, hex_color("#5fb9ed"), hex_color("#20de1d"));
        this.set_colors(this.trees.length);
        this.offset = vec3(0,0,0);
        this.light_offset = vec4(0,0,0,0);

        this.direction = 0;
        // next consider looking at planting trees along the road till the next pos, instead of only at the side of last bump
        // look at the bumps(trees) change the size and model to make them look nicer and have some randomnes
    }
    select_type(pos) {
        let plant_type = Math.random()*8;
        let selection;
        for(let i = 0; i < 20; i++){
            if(plant_type < 4){
                if(this.prepared_trees.length == 0){
                    continue;
                }
                selection = delete_from_arr(this.prepared_trees,0);
            }
            else if(plant_type < 5){
                if(this.prepared_trunks.length == 0){
                    continue;
                }
                selection = delete_from_arr(this.prepared_trunks,0);
            }
            else if(plant_type < 6){
                if(this.prepared_stumps.length == 0){
                    continue;
                }
                selection = delete_from_arr(this.prepared_stumps,0);
            }
            else if(plant_type < 7){
                if(this.prepared_leaves.length == 0){
                    continue;
                }
                selection = delete_from_arr(this.prepared_leaves,0);
            } else{
                if(this.prepared_stones.length == 0){
                    continue;
                }
                selection = delete_from_arr(this.prepared_stones,0);
            }
            selection.modify_pos(pos);
            return selection;
        }
        return new TreeBackground(pos,0.5+Math.random(),0.5+Math.random());
    }
    plant_tree_background(length,posx,posz,dir){
        let pos,tree_to_planting,trees2plant_num;
        trees2plant_num = 2 + Math.random()*length;
        if(dir == 0 && direction == 1){
            //plant trees on z-axis
            for(let i = 0; i < trees2plant_num; i++){
                if(Math.random() > 0.5){
                    pos = vec3(posx + length/3 + Math.random()*length, 0, posz + 6 + Math.random()*6);
                } else{
                    pos = vec3(posx + Math.random()*(length-length/2), 0, posz - 6 - Math.random()*6);
                }
                tree_to_planting = this.select_type(pos);
                add_to_arr(this.tree_backgrounds,tree_to_planting);
            }
        }
        else if(dir == 1 && direction == 0){
            for(let i = 0; i < trees2plant_num; i++){
                if(Math.random() > 0.5){
                    pos = vec3(posx + 6 + Math.random()*6, 0, posz - Math.random()*(length-length/2));
                } else{
                    pos = vec3(posx - 6 - Math.random()*6, 0, posz - length/3 - Math.random()*length);
                }
                tree_to_planting = this.select_type(pos);
                add_to_arr(this.tree_backgrounds,tree_to_planting);
            }
        }
        else if(dir == 0){
            for(let i = 0; i < trees2plant_num; i++){
                if(Math.random() > 0.5){
                    pos = vec3(posx - length/2 + Math.random()*(length+length/2), 0, posz + 6 + Math.random()*6);
                } else{
                    pos = vec3(posx - length/2 + Math.random()*(length-length/2), 0, posz -6 - Math.random()*6);
                }
                tree_to_planting = this.select_type(pos);
                add_to_arr(this.tree_backgrounds,tree_to_planting);
            }
        } else{
            //plant trees on x-axis
            for(let i = 0; i < trees2plant_num; i++){
                if(Math.random() > 0.5){
                    pos = vec3(posx + 6 + Math.random()*6, 0, posz + length/2 - Math.random()*(length-length/2));
                } else{
                    pos = vec3(posx - 6 - Math.random()*6, 0, posz + length/2 - Math.random()*(length+length/2));
                }
                tree_to_planting = this.select_type(pos);
                add_to_arr(this.tree_backgrounds,tree_to_planting);
            }
        }
    }

    set_colors(length) {
        // set color function
        // for (var i = 0; i < 8; i++) {
        //     this.colors[i] = color(Math.random(), Math.random(), Math.random(), 1.0);
        // }

        // Generate start_color with a broader range
        const start_color = color(0.5 - Math.random() * 0.5, 0.5 - Math.random() * 0.5, 0.5 - Math.random() * 0.5, 1.0);
        // console.log(start_color);

        // Generate end_color with a broader range
        const end_color = color( 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 1.0);
        // console.log(end_color);

        for (let i = 0; i < length; i++) {
            const t = i / (length - 1); // Calculate a ratio between 0 and 1

            // Interpolate between start_color and end_color based on the ratio 't'
            const new_color = color(
                start_color[0] * (1 - t) + end_color[0] * t,
                start_color[1] * (1 - t) + end_color[1] * t,
                start_color[2] * (1 - t) + end_color[2] * t,
                1.0
            );

            this.colors[i] = new_color;
        }
    }

    update_tree(){
        //this function called when player finally jumps(releases key)

        //also create a new block
        let lengthOptions = [6,8,10,12,14];
        let length1 = lengthOptions[Math.floor(Math.random() * lengthOptions.length)];
        let length2 = lengthOptions[Math.floor(Math.random() * lengthOptions.length)];
        let length3 = lengthOptions[Math.floor(Math.random() * lengthOptions.length)];
        let length4 = lengthOptions[Math.floor(Math.random() * lengthOptions.length)];
        // Decide the new positions for the next trees based on the jump length.
        let forwardPos = vec3(this.player.pos[0] + length1, 0, this.player.pos[2]);
        let leftPos = vec3(this.player.pos[0], 0, this.player.pos[2] - length2);
        let rightPos = vec3(this.player.pos[0], 0, this.player.pos[2] + length3);
        let backPos = vec3(this.player.pos[0] - length4, 0, this.player.pos[2]);
        // Create new trees at the calculated positions.
        let newTrees = [
            new Tree(forwardPos, 1.5, 1), // Forward
            new Tree(leftPos, 1.5, 1),    // Left
            new Tree(rightPos, 1.5, 1),    // Right
            new Tree(backPos, 1.5, 1)    // back
        ];

        // Add the current tree that the player is on to the new trees list.
        for (let tree of this.trees) {
            if (tree.pos[0] === this.player.pos[0] && tree.pos[2] === this.player.pos[2]) {
                newTrees.unshift(tree); // Add the current tree to the beginning of the array.
                break;
            }
        }

        // Replace the existing trees with the new set of trees.
        this.trees = newTrees;

        // Update the background for each new tree.
        this.plant_tree_background(length, this.player.pos[0], this.player.pos[2], 0); // Forward
        this.plant_tree_background(length, this.player.pos[0], this.player.pos[2], 1); // Left
        this.plant_tree_background(length, this.player.pos[0], this.player.pos[2], 2); // Right
    }

    update_bomb(context, program_state)
    {
        if(this.gameOver)
        {
            return;
        }


        // 创建一个从 0 到 this.trees.length-1 的整数数组
        const indices = Array.from({ length: this.trees.length }, (v, i) => i);

        // 随机排序这个数组
        // Fisher-Yates 洗牌算法
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]]; // 交换元素
            }
        }

        shuffleArray(indices);
        console.log(indices);
        // 通过随机排序的索引数组遍历 this.trees
        for (let index of indices) {
            let tree = this.trees[index];
            let is_found = -1;

            for (let j = 0; j < this.bomb.length; j++) {
                if (tree.pos[0] === this.bomb[j].pos[0] && tree.pos[2] === this.bomb[j].pos[2]) {
                    is_found = j;
                    break;
                }
            }

            if (is_found != -1) {
                    if (this.bomb[is_found].is_ready()) {
                        this.bomb[is_found].start();
                    }
            } 
            
            else {
                let ready_index = -1;
                for (let j = 0; j < this.bomb.length; j++) {
                    if (this.bomb[j].is_ready()) {
                        ready_index = j;
                        break;
                    }
                }

                if (ready_index === -1) {
                    continue;
                }

                this.bomb[ready_index].update_pos(vec3(tree.pos[0], tree.pos[1], tree.pos[2]));
                this.bomb[ready_index].start();
            }
        }



        this.bomb.forEach((f)=>{f.draw(context, program_state)});
        
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Welcome to JumpGame. Your objective is to make you avatar jump to blocks", ["i"], () => {});
        // this.key_triggered_button("Jump(distance proportional to duration of key press", ["j"], () => {this.player.jump(false)},
        //     '#6E6460', () => this.player.jump(true));
        this.jumpCountDisplay = () => {
            console.log("跳跃次数: " + this.jumpCount.toString()); // 根据实际情况更新游戏UI
        };
        // 首次调用以设置显示
        this.jumpCountDisplay();

        // Add jump logic for W, A, S, D keys
        this.key_triggered_button("Jump Forward", ["7"], () => {this.player.jump(false,0)},
            '#6E6460', () => this.player.jump(true,0));

        this.key_triggered_button("Jump Left", ["8"], () => {this.player.jump(false,1)},
            '#6E6460', () => this.player.jump(true,1));

        this.key_triggered_button("Jump Right", ["9"], () => {this.player.jump(false,2)},
            '#6E6460', () => this.player.jump(true,2));

        this.key_triggered_button("Jump back", ["0"], () => {this.player.jump(false,2)},
            '#6E6460', () => this.player.jump(true,3));

        this.key_triggered_button("Restart Game", ["q"], () => {
            this.init_game();
        });
    }
    updateJumpCountDisplay() {
        // 检查更新函数是否存在，并调用
        if (this.jumpCountDisplay) {
            this.jumpCountDisplay();
        }
    }

    bombExplosion(number){
        //TODO: the bomb explodes and not alive
        if (number < 0 || number >= this.bomb.length){
            console.error("Invalid bomb number");
            return;
        }
        if (!this.bomb[number]){
            console.error("Bomb at index" + number + " does not exist.");
            return;
        }
        console.log("Here we explode!");
        let bomb = this.bomb[number];
        if (bomb.is_alive != 1) return;
        // bomb.is_alive = 3;
        // bomb.shape = new Shape_From_File("./assets/objects/explosion.obj");
        // bomb.material = new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 0.4, color: hex_color("#FFA500")});
        // //bomb.draw(context, program_state);
        // bomb.is_alive = 0;
        let explosion = new Explosion(vec3(...bomb.pos));
        this.explosions.push(explosion);
        console.log("We reached here");
    }

    checkBombCollision(){
        for (let i = 0; i < this.bomb.length; i++)
        {
            if (this.bomb[i].is_alive !== 1) continue; // skip this bomb if not alive
            let distance = this.player.pos.minus(this.bomb[i].pos).norm();
            if (this.bomb[i].pos[0] == this.player.pos[0] && this.bomb[i].pos[2] == this.player.pos[2]){console.log("index: " + i + ", distance: " + distance);}
            
            if (distance < 0.1 && distance > 0.01) {
                console.log("collided by bomb " + i);
                return i;
            }
        }
        return -1;
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 3, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        TIMESTEP = program_state.animation_delta_time / 100;
        // let light_position = vec4(this.offset[0], this.offset[1], this.offset[2], 1);
        // let light_position = Mat4.rotation(t / 300, 1, 0, 0).times(vec4(-1, -1, -1, 1));

        // The parameters of the Light are: position, color, size
        program_state.lights = [this.light];

        //this.shapes.torus.draw(context, program_state, model_transform, this.materials.test.override({color: yellow}));
        /*let tree_transform = Mat4.rotation(Math.PI/2, 1, 0, 0);
        for (let i = 0; i<5; i++) {
            this.shapes.cylinder.draw(context, program_state, tree_transform, this.materials.test);
            tree_transform.pre_multiply(Mat4.translation(5,0,0));
        }*/

        let frustumPlanes = calculateFrustumPlanes(program_state.camera_inverse, program_state.projection_transform);

        if (this.player.ifStarted){
            var shading = false;
        }else{
            var shading = true;
        }
        for (let i = 0; i < this.trees.length; i++){
            if (isObjectWithinFrustum(this.trees[i], frustumPlanes)) {
                this.trees[i].draw(context, program_state, t, this.colors[i], shading, tree_pos);
            }
        }

        this.update_bomb(context, program_state);

        for(let explosion of this.explosions){
            explosion.draw(context, program_state);
        }
        this.explosions = this.explosions.filter(explosion => explosion.alive);

        // for (let i = 0; i < this.tree_backgrounds.length; i++){
        //     this.tree_backgrounds[i].draw(context, program_state, t, this.colors[i], shading, tree_pos);
        // }
        this.floor.draw(context, program_state, t, 0, shading, this.offset);
        this.skybox.draw(context, program_state);


        if(this.gameOver) {
            // this.jumpCount = 0; // 游戏结束，重置跳跃计数
            this.player.draw(context, program_state);
            if(this.time==0){
                //display gameover Message
                this.key_triggered_button("GAME OVER(will restart in 5 seconds), Jumps You Completed:" + this.jumpCount, ["i"], () => {});

                this.time=t;
            }else{
                if(t-this.time>5){
                    attempts++;
                    this.init_game();
                }
            }
            return;
        }

        this.floor.draw(context, program_state, t, 0, shading, this.offset);

        this.player.update();
        //if y coord<=1(height of blocks), then check if above a block, if yes stop, if not keep going
        //if not above a block fail end game

        if (this.player.pos[1] < 1) { //simply check if x-coord falls within that range
            this.onBlock=false;
            let block_x = 0;
            let block_y = 0;
            let block_z;
            let tree_ref = null;
            for (let tree of this.trees) {
                //make game easier by not looking at center of mass of block but just the edges
                if (move_dir == 0 || move_dir == 3){
                    if (tree.pos[0] - 1 <= this.player.pos[0] && tree.pos[0] + 1 >= this.player.pos[0]) {
                        this.onBlock = true;
                        block_x = tree.pos[0]
                        block_y = tree.pos[1]
                        block_z = tree.pos[2]
                        tree_ref = tree;

                    }
                }else{
                    if (tree.pos[2] - 1 <= this.player.pos[2] && tree.pos[2] + 1 >= this.player.pos[2]) {
                        this.onBlock = true;
                        block_x = tree.pos[0]
                        block_y = tree.pos[1]
                        block_z = tree.pos[2]
                        tree_ref = tree;
                    }
                }
            }
            if(this.onBlock==true) {
                this.jumpCount = this.jumpCount+1;
                console.log("count: ", this.jumpCount)
                this.updateJumpCountDisplay(); // 每当 `this.jumpCount` 改变时更新显示
                this.player.land(block_x, block_y, block_z, block_y + tree_ref.height);
                this.update_tree();
                this.skybox.update_center(this.player.pos.plus(vec3(0,20,0)));
                this.offset = vec3(this.player.pos[0], this.player.pos[1]-3, this.player.pos[2]);
                if (!debug){
                    //program_state.set_camera(Mat4.look_at(vec3(-6*factor+this.player.pos[0], 15*factor+this.player.pos[1], 8*factor+this.player.pos[2]), vec3(3+this.player.pos[0], 3+this.player.pos[1], 0+this.player.pos[2]), vec3(0, 1, 0)));
                    this.desired_camera_location = Mat4.look_at(vec3(-6*factor+this.player.pos[0], 15*factor+this.player.pos[1], 8*factor+this.player.pos[2]), vec3(3+this.player.pos[0], 3+this.player.pos[1], 0+this.player.pos[2]), vec3(0, 1, 0));

                }
                // new_initial_camera_location = Mat4.look_at(vec3(0+this.player.pos[0], 10+this.player.pos[1], 20), vec3(0, 0, 0), vec3(0, 1, 0));
                //generate new blocks and erase old blocks
            }
        }

        let collide = this.checkBombCollision();
        if (collide !== -1){
            this.bombExplosion(collide);
            this.player.inRotation = true;
            this.player.fly(context, program_state);
            this.gameOver = true;
        }
        // reset game if this happens

        if(this.player.pos[1]<=0){
            this.gameOver=true;

        }
        const camera_mat = this.desired_camera_location.map((x,i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
        program_state.set_camera(camera_mat);
        this.player.draw(context, program_state);

    }
}

// Gouraud Shader
class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        varying vec4 color; 

        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                // Added: calculate vertex's color 
                color = vec4(shape_color.xyz * ambient, shape_color.w);
                color.xyz += phong_model_lights(N, vertex_worldspace);
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){                                                           
                // Compute an initial (ambient) color:
                // gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                // Compute the final color with contributions from lights:
                // gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
                gl_FragColor = color;
                return;
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}


// for (let i = 0; i < this.tree_backgrounds.length; i++){
//     if (isObjectWithinFrustum(this.tree_backgrounds[i], frustumPlanes)) {
//         this.tree_backgrounds[i].draw(context, program_state, t, this.colors[i], shading, tree_pos);
//     } else{
//         let class_of = this.tree_backgrounds[i].identify();
//         if(class_of == 0){
//             let node = delete_from_arr(this.tree_backgrounds,i);
//             add_to_arr(this.prepared_trees,node);
//         }
//         else if(class_of == 1){
//             let node = delete_from_arr(this.tree_backgrounds,i);
//             add_to_arr(this.prepared_trunks,node);
//         }
//         else if(class_of == 2){
//             let node = delete_from_arr(this.tree_backgrounds,i);
//             add_to_arr(this.prepared_stumps,node);
//         }
//         else if(class_of == 3){
//             let node = delete_from_arr(this.tree_backgrounds,i);
//             add_to_arr(this.prepared_leaves,node);
//         } else{
//             let node = delete_from_arr(this.tree_backgrounds,i);
//             add_to_arr(this.prepared_stones,node);
//         }
//     }
// }