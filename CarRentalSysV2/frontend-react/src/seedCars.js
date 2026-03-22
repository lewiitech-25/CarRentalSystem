import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const sampleCars = [
  {
    carId: "C001",
    make: "Toyota",
    model: "Corolla",
    year: 2020,
    category: "Sedan",
    pricePerDay: 6000,
    licensePlate: "KDA123A",
    status: "Available"
  },
  {
    carId: "C002",
    make: "Mazda",
    model: "CX-5",
    year: 2022,
    category: "SUV",
    pricePerDay: 8500,
    licensePlate: "KDJ456B",
    status: "Available"
  },
  {
    carId: "C003",
    make: "Nissan",
    model: "Note",
    year: 2019,
    category: "Hatchback",
    pricePerDay: 4500,
    licensePlate: "KCY271M",
    status: "Available"
  },
  {
    carId: "C004",
    make: "Subaru",
    model: "Forester",
    year: 2021,
    category: "SUV",
    pricePerDay: 9500,
    licensePlate: "KDL889F",
    status: "Available"
  },
  {
    carId: "C005",
    make: "Honda",
    model: "Fit",
    year: 2018,
    category: "Hatchback",
    pricePerDay: 4000,
    licensePlate: "KBZ514P",
    status: "Available"
  },
  {
    carId: "C006",
    make: "Mercedes-Benz",
    model: "C200",
    year: 2023,
    category: "Luxury",
    pricePerDay: 18000,
    licensePlate: "KDM101X",
    status: "Available"
  },
  {
    carId: "C007",
    make: "BMW",
    model: "X3",
    year: 2022,
    category: "Luxury SUV",
    pricePerDay: 22000,
    licensePlate: "KDN222Y",
    status: "Available"
  },
  {
    carId: "C008",
    make: "Toyota",
    model: "Prado",
    year: 2021,
    category: "SUV",
    pricePerDay: 16000,
    licensePlate: "KCP700T",
    status: "Available"
  },
  {
    carId: "C009",
    make: "Suzuki",
    model: "Swift",
    year: 2020,
    category: "Hatchback",
    pricePerDay: 5000,
    licensePlate: "KCU381J",
    status: "Available"
  },
  {
    carId: "C010",
    make: "Volkswagen",
    model: "Passat",
    year: 2019,
    category: "Sedan",
    pricePerDay: 7500,
    licensePlate: "KCV904L",
    status: "Available"
  },
  {
    carId: "C011",
    make: "Range Rover",
    model: "Velar",
    year: 2023,
    category: "Luxury SUV",
    pricePerDay: 28000,
    licensePlate: "KDR808Q",
    status: "Available"
  },
  {
    carId: "C012",
    make: "Audi",
    model: "Q5",
    year: 2022,
    category: "Luxury SUV",
    pricePerDay: 24000,
    licensePlate: "KDS330Z",
    status: "Available"
  },
  {
    carId: "C013",
    make: "Toyota",
    model: "Hilux",
    year: 2021,
    category: "Pickup",
    pricePerDay: 14000,
    licensePlate: "KDT145H",
    status: "Available"
  },
  {
    carId: "C014",
    make: "Mitsubishi",
    model: "Outlander",
    year: 2020,
    category: "SUV",
    pricePerDay: 10500,
    licensePlate: "KDU562R",
    status: "Available"
  },
  {
    carId: "C015",
    make: "Hyundai",
    model: "Tucson",
    year: 2022,
    category: "SUV",
    pricePerDay: 9800,
    licensePlate: "KDV287N",
    status: "Available"
  },
  {
    carId: "C016",
    make: "Kia",
    model: "Sportage",
    year: 2021,
    category: "SUV",
    pricePerDay: 9600,
    licensePlate: "KDW611K",
    status: "Available"
  },
  {
    carId: "C017",
    make: "Peugeot",
    model: "208",
    year: 2019,
    category: "Hatchback",
    pricePerDay: 5200,
    licensePlate: "KDX903V",
    status: "Available"
  },
  {
    carId: "C018",
    make: "Toyota",
    model: "Rav4",
    year: 2022,
    category: "SUV",
    pricePerDay: 12500,
    licensePlate: "KDY417M",
    status: "Available"
  },
  {
    carId: "C019",
    make: "Nissan",
    model: "X-Trail",
    year: 2021,
    category: "SUV",
    pricePerDay: 11200,
    licensePlate: "KDZ750C",
    status: "Available"
  },
  {
    carId: "C020",
    make: "Mazda",
    model: "Demio",
    year: 2018,
    category: "Hatchback",
    pricePerDay: 4300,
    licensePlate: "KEA204S",
    status: "Available"
  },
  {
    carId: "C021",
    make: "Subaru",
    model: "Impreza",
    year: 2020,
    category: "Sedan",
    pricePerDay: 7200,
    licensePlate: "KEB618P",
    status: "Available"
  },
  {
    carId: "C022",
    make: "Lexus",
    model: "RX 350",
    year: 2023,
    category: "Luxury SUV",
    pricePerDay: 26000,
    licensePlate: "KEC932T",
    status: "Available"
  },
  {
    carId: "C023",
    make: "Honda",
    model: "CR-V",
    year: 2021,
    category: "SUV",
    pricePerDay: 11800,
    licensePlate: "KED341L",
    status: "Available"
  },
  {
    carId: "C024",
    make: "Isuzu",
    model: "D-Max",
    year: 2022,
    category: "Pickup",
    pricePerDay: 15000,
    licensePlate: "KEE820B",
    status: "Available"
  },
  {
    carId: "C025",
    make: "Mercedes-Benz",
    model: "GLC 300",
    year: 2022,
    category: "Luxury SUV",
    pricePerDay: 27500,
    licensePlate: "KEF107W",
    status: "Available"
  },
  {
    carId: "C026",
    make: "BMW",
    model: "320i",
    year: 2021,
    category: "Luxury Sedan",
    pricePerDay: 21000,
    licensePlate: "KEG554D",
    status: "Available"
  },
  {
    carId: "C027",
    make: "Toyota",
    model: "Vitz",
    year: 2018,
    category: "Hatchback",
    pricePerDay: 3900,
    licensePlate: "KEH778Y",
    status: "Available"
  },
  {
    carId: "C028",
    make: "Ford",
    model: "Everest",
    year: 2023,
    category: "SUV",
    pricePerDay: 17000,
    licensePlate: "KEJ292F",
    status: "Available"
  }
];

export async function seedCars() {
  try {
    for (const car of sampleCars) {
      const carRef = doc(db, "cars", car.carId);
      const existingCar = await getDoc(carRef);

      if (existingCar.exists()) {
        continue;
      }

      await setDoc(carRef, {
        ...car,
        createdAt: serverTimestamp()
      });
    }
    console.log("Cars added successfully");
  } catch (error) {
    console.error("Error seeding cars:", error);
  }
}
